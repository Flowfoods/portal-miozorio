import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies, headers } from "next/headers";
import bcrypt from "bcryptjs";
import { prisma } from "./prisma";
import { normalizeE164BR } from "./phone";
import { lockoutMs } from "./security";
import { EV, getSid, mergeAnonToClient, track } from "./tracking";
import { isIpThrottled, maskPhone, metaFromHeaders, recordAuth } from "./authlog";

/**
 * Autenticação do PORTAL DO CLIENTE (Clube) — separada da do /admin (NextAuth).
 * Sessão = cookie httpOnly assinado por HMAC-SHA256 (segredo NEXTAUTH_SECRET).
 * Guarda só o customerId + flag de senha provisória; toda query do portal filtra
 * por esse id (isolamento — o cliente NUNCA passa id por URL/payload).
 *
 * Senha inicial = telefone: enquanto `clubPasswordHash` é null e
 * `clubPasswordProvisoria` é true, o login compara contra os dígitos do telefone
 * e o portal força a troca antes de liberar qualquer dado.
 */

const COOKIE = "mi_clube";
const TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 dias
/** Mínimo da nova senha do cliente (portal de fidelidade, não admin). */
export const CLUB_MIN_SENHA = 6;

function secret(): string {
  const s = process.env.NEXTAUTH_SECRET;
  if (!s) throw new Error("NEXTAUTH_SECRET ausente");
  return s;
}

function sign(data: string): string {
  return createHmac("sha256", secret()).update(data).digest("base64url");
}

function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

export interface ClienteSession {
  customerId: string;
  prov: boolean; // true = senha ainda provisória (acesso bloqueado até trocar)
}

function encode(payload: ClienteSession & { exp: number }): string {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${sign(body)}`;
}

function decode(token: string): (ClienteSession & { exp: number }) | null {
  const [body, sig] = token.split(".");
  if (!body || !sig || !safeEqual(sig, sign(body))) return null;
  try {
    const p = JSON.parse(Buffer.from(body, "base64url").toString());
    if (typeof p?.customerId !== "string" || typeof p?.exp !== "number") return null;
    if (p.exp < Date.now()) return null;
    return p;
  } catch {
    return null;
  }
}

function setCookie(session: ClienteSession): void {
  cookies().set(COOKIE, encode({ ...session, exp: Date.now() + TTL_MS }), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: TTL_MS / 1000,
  });
}

/** Sessão do cliente logado (ou null). Nunca confia em id vindo do request. */
export function getClienteSession(): ClienteSession | null {
  const raw = cookies().get(COOKIE)?.value;
  if (!raw) return null;
  const d = decode(raw);
  return d ? { customerId: d.customerId, prov: d.prov } : null;
}

export function logoutCliente(): void {
  cookies().delete(COOKIE);
}

/**
 * Estabelece a sessão da cliente já com senha definitiva (prov=false). Usado
 * pela recuperação por WhatsApp (F2.2), que ao trocar a senha já entra logada.
 */
export function iniciarSessaoCliente(customerId: string): void {
  setCookie({ customerId, prov: false });
}

export type LoginResult =
  | { ok: true; mustChange: boolean }
  | { ok: false; message: string };

const GENERIC = "Telefone ou senha incorretos.";

/** Dígitos puros (sem +/DDI duplicado) — base da senha provisória. */
function digits(s: string): string {
  return s.replace(/\D/g, "");
}

export async function loginCliente(
  phoneRaw: string,
  password: string,
): Promise<LoginResult> {
  const phone = normalizeE164BR(phoneRaw);
  if (!phone || !password) return { ok: false, message: GENERIC };

  const meta = metaFromHeaders(headers());
  const ident = maskPhone(phone);

  // Rate-limit por IP (defesa-em-profundidade além da trava por conta).
  if (await isIpThrottled(meta.ip)) {
    await recordAuth("cliente", "throttled", ident, meta);
    return {
      ok: false,
      message: "Muitas tentativas. Tente de novo em alguns minutos.",
    };
  }

  const c = await prisma.customer.findUnique({ where: { phoneE164: phone } });
  // Só membros do clube acessam; resposta genérica não revela existência (LGPD).
  if (!c || !c.clubJoinedAt) {
    await recordAuth("cliente", "login_fail", ident, meta);
    return { ok: false, message: GENERIC };
  }

  if (c.clubLockedUntil && c.clubLockedUntil > new Date()) {
    await recordAuth("cliente", "locked", ident, meta);
    return {
      ok: false,
      message: "Muitas tentativas. Tente de novo em alguns minutos.",
    };
  }

  // Senha provisória (hash null) = compara contra os dígitos do telefone.
  const phoneDigits = digits(c.phoneE164);
  const valid = c.clubPasswordHash
    ? bcrypt.compareSync(password, c.clubPasswordHash)
    : digits(password) === phoneDigits ||
      digits(password) === phoneDigits.replace(/^55/, "");

  if (!valid) {
    const failed = c.clubFailedLogins + 1;
    const ms = lockoutMs(failed);
    await prisma.customer.update({
      where: { id: c.id },
      data: {
        clubFailedLogins: failed,
        clubLockedUntil: ms > 0 ? new Date(Date.now() + ms) : c.clubLockedUntil,
      },
    });
    await recordAuth("cliente", ms > 0 ? "locked" : "login_fail", ident, meta);
    return { ok: false, message: GENERIC };
  }

  if (c.clubFailedLogins > 0 || c.clubLockedUntil) {
    await prisma.customer.update({
      where: { id: c.id },
      data: { clubFailedLogins: 0, clubLockedUntil: null },
    });
  }

  setCookie({ customerId: c.id, prov: c.clubPasswordProvisoria });
  await recordAuth("cliente", "login_ok", ident, meta);
  // Tracking F1 (best-effort): amarra a sessão anônima à cliente e registra o
  // login. Nunca bloqueia o login se algo falhar.
  const sid = getSid();
  await mergeAnonToClient(c.id, sid);
  await track({ tipo: EV.LOGIN_CLUBE, clientId: c.id, sessionId: sid });
  return { ok: true, mustChange: c.clubPasswordProvisoria };
}

export type SetPasswordResult = { ok: true } | { ok: false; message: string };

/**
 * Define a nova senha do cliente (1ª troca obrigatória ou rotina). Exige a
 * sessão dele (customerId vem da sessão, nunca do form). Registra consentimento
 * LGPD na 1ª troca e renova o cookie já sem o flag provisório.
 */
export async function setClientePassword(
  newPassword: string,
  consent: boolean,
): Promise<SetPasswordResult> {
  const s = getClienteSession();
  if (!s) return { ok: false, message: "Sessão expirada. Entre de novo." };
  if (newPassword.length < CLUB_MIN_SENHA) {
    return {
      ok: false,
      message: `A senha precisa de pelo menos ${CLUB_MIN_SENHA} caracteres.`,
    };
  }
  const c = await prisma.customer.findUnique({ where: { id: s.customerId } });
  if (!c) return { ok: false, message: "Conta não encontrada." };
  if (c.clubPasswordProvisoria && !consent) {
    return { ok: false, message: "Para continuar, aceite a política de privacidade." };
  }
  // Não deixar a nova senha ser o próprio telefone (continuaria adivinhável).
  if (digits(newPassword) && digits(newPassword) === digits(c.phoneE164)) {
    return { ok: false, message: "Escolha uma senha diferente do seu telefone." };
  }

  await prisma.customer.update({
    where: { id: c.id },
    data: {
      clubPasswordHash: bcrypt.hashSync(newPassword, 12),
      clubPasswordProvisoria: false,
      clubFailedLogins: 0,
      clubLockedUntil: null,
      clubConsentAt: c.clubConsentAt ?? new Date(),
    },
  });
  setCookie({ customerId: c.id, prov: false });
  await recordAuth(
    "cliente",
    "password_changed",
    maskPhone(c.phoneE164),
    metaFromHeaders(headers()),
  );
  return { ok: true };
}
