import { createHash } from "node:crypto";
import { prisma } from "./prisma";

/**
 * Auditoria de autenticação (Auth F1.2) — dos dois portais (admin e cliente).
 * Regras (diretrizes transversais): NUNCA registrar senha/token/código; IP só
 * hasheado (LGPD); telefone da cliente mascarado. Gravar é SEMPRE best-effort:
 * uma falha de log jamais pode derrubar um login.
 *
 * A mesma tabela alimenta o rate-limit por IP (falhas recentes por ip_hash),
 * defesa-em-profundidade além da trava por conta que já existe (security.ts).
 */

export type AuthArea = "admin" | "cliente";

export type AuthEvent =
  | "login_ok"
  | "login_fail"
  | "locked" // conta travada por brute-force (recusada sem checar senha)
  | "throttled" // recusado pelo rate-limit por IP
  | "reset_request" // admin pediu link de redefinição por e-mail
  | "reset_done" // admin concluiu a redefinição
  | "recover_request" // cliente pediu código de recuperação
  | "recover_ok" // cliente validou o código e trocou a senha
  | "recover_fail" // código errado/expirado
  | "password_changed"; // troca de senha logada (cliente/admin)

export interface AuthMeta {
  ip?: string | null;
  userAgent?: string | null;
}

// ── Janela do rate-limit por IP ──────────────────────────────────────────────
/** Janela de contagem de falhas por IP. */
export const IP_WINDOW_MS = 15 * 60_000;
/**
 * Falhas toleradas por IP na janela antes do bloqueio gentil. Mais alto que a
 * trava por conta (5) porque um IP pode ser NAT/compartilhado (evita punir uma
 * casa/estúdio inteiro por causa de uma pessoa).
 */
export const IP_MAX_FAILS = 20;

/** SHA-256 do IP — nunca guardamos o IP cru (LGPD). */
export function hashIp(ip: string): string {
  return createHash("sha256").update(ip).digest("hex");
}

/** Primeiro IP do `x-forwarded-for` (Traefik) com fallback ao `x-real-ip`. */
export function clientIp(
  forwardedFor?: string | null,
  realIp?: string | null,
): string | null {
  const fwd = (forwardedFor ?? "").split(",")[0]?.trim();
  return fwd || (realIp ?? "").trim() || null;
}

/** Extrai { ip, userAgent } de um objeto de headers (Fetch Headers ou plain). */
export function metaFromHeaders(
  h:
    | Headers
    | Record<string, string | string[] | undefined>
    | undefined
    | null,
): AuthMeta {
  if (!h) return {};
  const get = (k: string): string | null => {
    if (typeof (h as Headers).get === "function") return (h as Headers).get(k);
    const v = (h as Record<string, string | string[] | undefined>)[k];
    return Array.isArray(v) ? (v[0] ?? null) : (v ?? null);
  };
  return {
    ip: clientIp(get("x-forwarded-for"), get("x-real-ip")),
    userAgent: get("user-agent"),
  };
}

/** Telefone → identificador seguro no log: só os 4 últimos dígitos (••••1234). */
export function maskPhone(raw: string): string {
  const d = raw.replace(/\D/g, "");
  return d.length >= 4 ? `••••${d.slice(-4)}` : "••••";
}

/**
 * Registra um evento de auth. Best-effort: engole qualquer erro (inclusive
 * tabela ausente antes da migration) para nunca interromper o fluxo de login.
 */
export async function recordAuth(
  area: AuthArea,
  event: AuthEvent,
  identifier: string | null,
  meta: AuthMeta = {},
): Promise<void> {
  try {
    await prisma.authLog.create({
      data: {
        area,
        event,
        identifier: identifier ?? null,
        ipHash: meta.ip ? hashIp(meta.ip) : null,
        userAgent: meta.userAgent?.slice(0, 400) ?? null,
      },
    });
  } catch {
    // silencioso de propósito (R: log não pode quebrar login)
  }
}

/**
 * Rate-limit por IP: true se este IP acumulou falhas demais na janela. Conta
 * `login_fail` e `recover_fail` do mesmo ip_hash. Best-effort — se a checagem
 * falhar, libera (fail-open): trava por conta continua protegendo.
 */
export async function isIpThrottled(ip: string | null | undefined): Promise<boolean> {
  if (!ip) return false;
  try {
    const desde = new Date(Date.now() - IP_WINDOW_MS);
    const fails = await prisma.authLog.count({
      where: {
        ipHash: hashIp(ip),
        event: { in: ["login_fail", "recover_fail"] },
        createdAt: { gte: desde },
      },
    });
    return fails >= IP_MAX_FAILS;
  } catch {
    return false;
  }
}
