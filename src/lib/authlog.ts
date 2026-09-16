import { createHash, createHmac } from "node:crypto";
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
  | "booking_new"; // reserva criada pelo site (substrato do limite por IP)

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

// ── Janela de RESERVAS por IP (POST /api/bookings) ───────────────────────────
/** Janela de contagem de reservas criadas pelo mesmo IP. */
export const BOOKING_IP_WINDOW_MS = 60 * 60_000;
/**
 * Reservas toleradas por IP na janela.
 *
 * Conta reservas CRIADAS, não falhas: o abuso aqui não é errar, é acertar
 * muitas vezes — cada reserva nasce com hold e segura um horário na agenda. O
 * honeypot e o teto de reservas em aberto por telefone já cobrem o bot burro;
 * este limite fecha a brecha de quem troca de telefone a cada POST.
 *
 * 10/h é folgado de propósito. Um IP pode ser NAT (prédio, estúdio, operadora
 * móvel), e punir uma casa inteira por causa de uma pessoa é pior do que o
 * abuso que estamos evitando. Nenhum caminho do painel passa por esta rota —
 * só o wizard público —, então a Mi nunca esbarra nisto.
 */
export const BOOKING_IP_MAX = 10;

// ── Janela de PEDIDOS DE CÓDIGO por IP (recuperação de senha) ────────────────
/** Janela de contagem de pedidos de código de recuperação pelo mesmo IP. */
export const RECUP_IP_WINDOW_MS = 60 * 60_000;
/**
 * Pedidos de código tolerados por IP na janela. Cada pedido de conta existente
 * vira uma mensagem no WhatsApp da Mi; sem teto por IP, um único script com
 * uma lista de telefones enchia o WhatsApp dela — e podia derrubar o número
 * por spam. O teto por cadastro (3/h) não segura isso: é por pessoa, não por
 * origem.
 */
export const RECUP_IP_MAX = 10;

/**
 * Função pura de janela deslizante: dadas as datas dos eventos recentes (em
 * qualquer ordem), diz se estourou o teto e quantos minutos faltam para
 * liberar. O bloqueio cai quando o N-ésimo evento mais recente sai da janela —
 * nunca é bloqueio "para sempre".
 *
 * Nasceu para falhas de login por identificador (daí o nome) e serve para
 * qualquer contagem por janela: os limites passam por parâmetro.
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

const LIVRE = { bloqueado: false, minutos: 0 };

/**
 * Janela deslizante por IP sobre o auth_log. Best-effort — se a consulta
 * falhar, libera (fail-open): é rate-limit, a trava por conta continua.
 *
 * `inclusivo` = a chamada acontece DEPOIS de registrar a própria tentativa, que
 * então entra na conta; o teto vira "max anteriores + esta". Registrar antes de
 * contar é o que segura uma rajada: N requisições simultâneas liam o mesmo
 * total e passavam todas pela checagem antes de qualquer uma ser gravada.
 */
async function janelaPorIp(
  ip: string | null | undefined,
  eventos: AuthEvent[],
  max: number,
  janelaMs: number,
  inclusivo: boolean,
): Promise<{ bloqueado: boolean; minutos: number }> {
  if (!ip) return { ...LIVRE };
  try {
    const teto = inclusivo ? max + 1 : max;
    const recentes = await prisma.authLog.findMany({
      where: {
        ipHash: hashIp(ip),
        event: { in: eventos },
        createdAt: { gte: new Date(Date.now() - janelaMs) },
      },
      orderBy: { createdAt: "desc" },
      take: teto,
      select: { createdAt: true },
    });
    return esperaPorIdentificador(
      recentes.map((r) => r.createdAt),
      new Date(),
      teto,
      janelaMs,
    );
  } catch {
    return { ...LIVRE };
  }
}

/**
 * Rate-limit por IP das FALHAS de auth (login errado, código errado): 20 em
 * 15 min. Devolve quanto falta esperar — bloqueio nunca é silencioso.
 */
export async function throttlePorIp(
  ip: string | null | undefined,
): Promise<{ bloqueado: boolean; minutos: number }> {
  return janelaPorIp(
    ip,
    ["login_fail", "recover_fail"],
    IP_MAX_FAILS,
    IP_WINDOW_MS,
    false,
  );
}

/**
 * Rate-limit de RESERVAS por IP (`POST /api/bookings`): 10 reservas por hora no
 * mesmo IP. Chame DEPOIS de registrar a tentativa (`booking_new`) — ela entra
 * na conta. Fail-open: derrubar o agendamento porque o log de auditoria está
 * indisponível seria trocar um abuso raro por perda de receita certa.
 */
export async function throttleReservasPorIp(
  ip: string | null | undefined,
): Promise<{ bloqueado: boolean; minutos: number }> {
  return janelaPorIp(
    ip,
    ["booking_new"],
    BOOKING_IP_MAX,
    BOOKING_IP_WINDOW_MS,
    true,
  );
}

/**
 * Rate-limit de PEDIDOS DE CÓDIGO por IP (recuperação de senha): 10 por hora.
 * Chame DEPOIS de registrar o pedido (`recover_request`).
 */
export async function throttlePedidosPorIp(
  ip: string | null | undefined,
): Promise<{ bloqueado: boolean; minutos: number }> {
  return janelaPorIp(
    ip,
    ["recover_request"],
    RECUP_IP_MAX,
    RECUP_IP_WINDOW_MS,
    true,
  );
}

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
 * Chave de um telefone no auth_log: os 4 últimos dígitos (o que a Mi lê na
 * tela de Acessos) + um HMAC curto do número inteiro.
 *
 * Só os 4 últimos dígitos eram a chave do rate-limit por identificador (B4) —
 * e 10^4 baldes é pouco: duas clientes com o mesmo final dividiam o balde de
 * 10 falhas, e bastava errar 10 vezes num número QUALQUER terminado em 6845
 * para pausar o login de todas as clientes com esse final. O HMAC separa os
 * baldes sem gravar o telefone: a chave é NEXTAUTH_SECRET, e sem ela ninguém
 * reverte por força bruta o espaço de ~10^9 números.
 */
export function identTelefone(phoneE164: string): string {
  const d = phoneE164.replace(/\D/g, "");
  const tag = createHmac("sha256", process.env.NEXTAUTH_SECRET ?? "")
    .update(d)
    .digest("hex")
    .slice(0, 10);
  return `${maskPhone(phoneE164)}·${tag}`;
}

/** O que mostrar na tela: `••••6845·a1b2c3d4e5` vira `••••6845`. */
export function identificadorVisivel(
  identifier: string | null | undefined,
): string {
  if (!identifier) return "—";
  return identifier.split("·")[0] ?? identifier;
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
): Promise<bigint | null> {
  try {
    const row = await prisma.authLog.create({
      data: {
        area,
        event,
        identifier: identifier ?? null,
        ipHash: meta.ip ? hashIp(meta.ip) : null,
        userAgent: meta.userAgent?.slice(0, 400) ?? null,
      },
      select: { id: true },
    });
    return row.id;
  } catch {
    // silencioso de propósito (R: log não pode quebrar login)
    return null;
  }
}

/**
 * Apaga um registro (best-effort). A rota de reservas registra a TENTATIVA
 * antes de criar a reserva; se ela não vira reserva (horário tomado, foto
 * inválida), o registro sai para não cobrar da pessoa uma reserva que não
 * existiu.
 */
export async function apagarRegistroAuth(
  id: bigint | null | undefined,
): Promise<void> {
  if (id == null) return;
  try {
    await prisma.authLog.delete({ where: { id } });
  } catch {
    // best-effort
  }
}

/**
 * Rate-limit por IP: true se este IP acumulou falhas demais na janela (`login_fail`
 * e `recover_fail` do mesmo ip_hash). Atalho de `throttlePorIp` para quem só
 * precisa do sim/não.
 */
export async function isIpThrottled(
  ip: string | null | undefined,
): Promise<boolean> {
  return (await throttlePorIp(ip)).bloqueado;
}
