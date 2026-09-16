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
  | "password_changed" // troca de senha logada (cliente/admin)
  | "passkey_added" // cadastrou uma passkey (Face ID/biometria)
  | "passkey_login" // entrou por passkey
  | "booking_create" // reserva pública criada (base do teto por IP)
  | "booking_throttled"; // criação de reserva recusada pelo teto por IP

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

// ── Janela do rate-limit por IDENTIFICADOR (B4) ──────────────────────────────
/** Janela de contagem de falhas de login por identificador (telefone/e-mail). */
export const IDENT_WINDOW_MS = 15 * 60_000;
/** Falhas toleradas no mesmo identificador dentro da janela. */
export const IDENT_MAX_FAILS = 10;

// ── Janela do teto de reservas por IP (rota pública de agendamento) ──────────
/** Janela de contagem das reservas criadas pelo mesmo IP. */
export const RESERVA_IP_WINDOW_MS = 60 * 60_000;
/**
 * Reservas que um mesmo IP pode criar na janela. Folgado de propósito: o CGNAT
 * das operadoras móveis põe muita cliente atrás do mesmo IP, e a Mi atende um
 * punhado de pessoas por dia — dez reservas numa hora do mesmo lugar já é
 * ordens de grandeza acima do movimento real, e continua sendo o bastante para
 * transformar um ataque de centenas de horários travados em dez.
 */
export const RESERVA_IP_MAX = 10;

/**
 * Eventos que NÃO são acesso e ficam fora da tela "Acessos & segurança".
 *
 * Aquela tela lista os últimos 100 eventos sem filtro nenhum. `booking_create`
 * acompanha o movimento normal do site, então sem esta exclusão ele empurraria
 * as entradas e tentativas — que são o assunto da tela — para fora dela em um
 * fim de semana movimentado. `booking_throttled` fica: é raro e é sinal de
 * segurança, igual ao `throttled` do login.
 */
export const EVENTOS_FORA_DOS_ACESSOS: AuthEvent[] = ["booking_create"];

/**
 * Função pura: dadas as datas recentes (mais nova primeiro), diz se está
 * bloqueado e quantos minutos faltam. O bloqueio cai quando a N-ésima data mais
 * recente sai da janela — nunca é bloqueio "para sempre".
 *
 * É o núcleo deslizante compartilhado: serve tanto às falhas de login por
 * identificador quanto ao teto de reservas por IP, com janela e teto próprios.
 */
export function esperaPorIdentificador(
  falhas: Date[],
  agora: Date = new Date(),
  max: number = IDENT_MAX_FAILS,
  janelaMs: number = IDENT_WINDOW_MS,
): { bloqueado: boolean; minutos: number } {
  const dentro = falhas
    .filter((d) => agora.getTime() - d.getTime() < janelaMs)
    .sort((a, b) => b.getTime() - a.getTime());
  if (dentro.length < max) return { bloqueado: false, minutos: 0 };
  const decisiva = dentro[max - 1]!;
  const faltaMs = janelaMs - (agora.getTime() - decisiva.getTime());
  return { bloqueado: true, minutos: Math.max(1, Math.ceil(faltaMs / 60_000)) };
}

/**
 * Rate-limit por identificador: 10 falhas em 15 min pausam aquele telefone/
 * e-mail, independente do IP. Best-effort — se a checagem falhar, libera (a
 * trava por conta continua protegendo).
 */
export async function throttlePorIdentificador(
  area: AuthArea,
  identifier: string,
): Promise<{ bloqueado: boolean; minutos: number }> {
  try {
    const desde = new Date(Date.now() - IDENT_WINDOW_MS);
    const falhas = await prisma.authLog.findMany({
      where: {
        area,
        identifier,
        event: { in: ["login_fail", "locked"] },
        createdAt: { gte: desde },
      },
      orderBy: { createdAt: "desc" },
      take: IDENT_MAX_FAILS,
      select: { createdAt: true },
    });
    return esperaPorIdentificador(falhas.map((f) => f.createdAt));
  } catch {
    return { bloqueado: false, minutos: 0 };
  }
}

/** SHA-256 do IP — nunca guardamos o IP cru (LGPD). */
export function hashIp(ip: string): string {
  return createHash("sha256").update(ip).digest("hex");
}

/**
 * IP do request: `x-real-ip` primeiro, `x-forwarded-for` como reserva.
 *
 * A ordem importa e já foi o contrário. O Traefik **acrescenta** o IP real ao
 * `x-forwarded-for` que chegou, sem apagar o que veio — então quem manda o
 * próprio `X-Forwarded-For: 1.2.3.4` fica em PRIMEIRO na lista, e ler o
 * primeiro item entregava ao cliente a escolha do próprio balde de rate limit.
 * Girar esse header contornava o teto inteiro, de graça.
 *
 * `x-real-ip` o Traefik **sobrescreve** com o peer TCP, que o cliente não
 * forja. Onde não há proxy os dois faltam e isto devolve null — os tetos não
 * armam, que é o certo: não dá para punir um IP que não se conhece.
 *
 * ⚠️ Vale para UM proxy na frente (o nosso caso). Numa cadeia de dois, o
 * `x-real-ip` do interno seria o IP do externo, e todo mundo cairia no mesmo
 * balde — daí o certo passaria a ser o ÚLTIMO item do `x-forwarded-for`.
 */
export function clientIp(
  forwardedFor?: string | null,
  realIp?: string | null,
): string | null {
  const real = (realIp ?? "").trim();
  if (real) return real;
  const fwd = (forwardedFor ?? "").split(",")[0]?.trim();
  return fwd || null;
}

/** Extrai { ip, userAgent } de um objeto de headers (Fetch Headers ou plain). */
export function metaFromHeaders(
  h: Headers | Record<string, string | string[] | undefined> | undefined | null,
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
export async function isIpThrottled(
  ip: string | null | undefined,
): Promise<boolean> {
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

/**
 * Teto de reservas por IP — versão pura, para os testes dirigirem o relógio.
 * Conta CRIAÇÕES, não tentativas: quem erra o formulário cinco vezes não pode
 * ficar sem conseguir marcar.
 */
export function esperaDeReservaPorIp(
  criacoes: Date[],
  agora: Date = new Date(),
): { bloqueado: boolean; minutos: number } {
  return esperaPorIdentificador(
    criacoes,
    agora,
    RESERVA_IP_MAX,
    RESERVA_IP_WINDOW_MS,
  );
}

/**
 * Teto de reservas em aberto por IP na rota pública de agendamento.
 *
 * O teto por telefone (`MAX_PENDING_POR_TELEFONE`, no `booking-service`) já
 * barra o abuso realista, mas não alcança quem troca o telefone a cada POST —
 * e cada reserva nova segura um horário durante todo o hold. Com a agenda de
 * fim de semana e passo de 30 min, algumas centenas de requisições deixavam a
 * agenda intransitável sem um único agendamento aparecer para a Mi.
 *
 * Best-effort como o resto do `authlog`: se a consulta falhar, libera. Uma
 * falha de log nunca pode impedir alguém de marcar horário.
 */
export async function throttleDeReservaPorIp(
  ip: string | null | undefined,
): Promise<{ bloqueado: boolean; minutos: number }> {
  if (!ip) return { bloqueado: false, minutos: 0 };
  try {
    const desde = new Date(Date.now() - RESERVA_IP_WINDOW_MS);
    const criacoes = await prisma.authLog.findMany({
      where: {
        ipHash: hashIp(ip),
        event: "booking_create",
        createdAt: { gte: desde },
      },
      orderBy: { createdAt: "desc" },
      take: RESERVA_IP_MAX,
      select: { createdAt: true },
    });
    return esperaDeReservaPorIp(criacoes.map((c) => c.createdAt));
  } catch {
    return { bloqueado: false, minutos: 0 };
  }
}
