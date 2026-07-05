import {
  createHash,
  createHmac,
  randomInt,
  timingSafeEqual,
} from "node:crypto";
import { cookies, headers } from "next/headers";
import bcrypt from "bcryptjs";
import { prisma } from "./prisma";
import { normalizeE164BR } from "./phone";
import { sendEvolutionText, evolutionConfigured } from "./notify";
import { sendClubRecoveryEmail } from "./email";
import { senhaFraca } from "./security";
import { CLUB_MIN_SENHA, iniciarSessaoCliente } from "./cliente-auth";
import {
  isIpThrottled,
  maskPhone,
  metaFromHeaders,
  recordAuth,
} from "./authlog";

/**
 * Recuperação de senha da CLIENTE por código no WhatsApp (Auth F2.2). O público
 * da Mi esquece senha com facilidade — WhatsApp é o canal mais eficaz.
 *
 * Segurança: código de 6 dígitos, só o SHA-256 vai ao banco; validade 10min;
 * máx. 3 tentativas de digitação; reenvio com cooldown de 60s; uso único.
 * Resposta SEMPRE neutra — nunca revela se o telefone existe (anti-enumeração).
 * Entre a validação do código e a nova senha há um "vale" curto assinado por
 * HMAC em cookie httpOnly (10min), para autorizar só a troca daquela cliente.
 */

const CODE_TTL_MS = 10 * 60_000;
const MAX_ATTEMPTS = 3;
const RESEND_COOLDOWN_MS = 60_000;
const REC_COOKIE = "mi_clube_rec";

/** Resposta neutra do pedido — não revela existência do telefone. */
export const RECUP_NEUTRO =
  "Se este número tiver conta no Clube, enviamos um código por WhatsApp.";

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
function hashCode(code: string): string {
  return createHash("sha256").update(code).digest("hex");
}
/** Código numérico de 6 dígitos, aleatório criptográfico. */
function gerarCodigo(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

// ── "Vale" de troca (cookie assinado, curto) ─────────────────────────────────
function setValeCookie(customerId: string): void {
  const payload = `${customerId}.${Date.now() + CODE_TTL_MS}`;
  cookies().set(REC_COOKIE, `${payload}.${sign(payload)}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/clube",
    maxAge: CODE_TTL_MS / 1000,
  });
}
function lerValeCookie(): string | null {
  const raw = cookies().get(REC_COOKIE)?.value;
  if (!raw) return null;
  const i = raw.lastIndexOf(".");
  if (i < 0) return null;
  const body = raw.slice(0, i);
  const sig = raw.slice(i + 1);
  if (!safeEqual(sig, sign(body))) return null;
  const [customerId, expStr] = body.split(".");
  if (!customerId || !expStr || Number(expStr) < Date.now()) return null;
  return customerId;
}
function limparValeCookie(): void {
  cookies().delete(REC_COOKIE);
}

export type RecupResult = { ok: true } | { ok: false; message: string };

/** Só dígitos — base do texto do WhatsApp. */
function digits(s: string): string {
  return s.replace(/\D/g, "");
}

/**
 * Passo 1 — pedido do código. Resposta sempre neutra (a UI avança pro passo do
 * código independentemente de o telefone existir). Envia por WhatsApp e, se a
 * cliente tiver e-mail, também por e-mail (fallback). Respeita cooldown de 60s.
 */
export async function solicitarRecuperacao(phoneRaw: string): Promise<void> {
  const meta = metaFromHeaders(headers());
  const phone = normalizeE164BR(phoneRaw);
  if (!phone) return; // neutro: nem tenta
  const ident = maskPhone(phone);

  // Rate-limit por IP também aqui (pedidos de código).
  if (await isIpThrottled(meta.ip)) {
    await recordAuth("cliente", "throttled", ident, meta);
    return;
  }

  const c = await prisma.customer.findUnique({ where: { phoneE164: phone } });
  if (!c || !c.clubJoinedAt) return; // neutro: não revela

  // Cooldown de reenvio: se já mandamos há menos de 60s, não repete (neutro).
  const recente = await prisma.clubPasswordReset.findFirst({
    where: { customerId: c.id, usedAt: null },
    orderBy: { createdAt: "desc" },
  });
  if (recente && Date.now() - recente.lastSentAt.getTime() < RESEND_COOLDOWN_MS) {
    return;
  }

  // Invalida códigos anteriores não usados e cria o novo.
  await prisma.clubPasswordReset.updateMany({
    where: { customerId: c.id, usedAt: null },
    data: { usedAt: new Date() },
  });
  const codigo = gerarCodigo();
  await prisma.clubPasswordReset.create({
    data: {
      customerId: c.id,
      codeHash: hashCode(codigo),
      expiresAt: new Date(Date.now() + CODE_TTL_MS),
    },
  });

  // Envio (best-effort): WhatsApp primeiro; e-mail se houver. Falha não vaza.
  const texto = `Oi! 💛 Seu código para recuperar o acesso ao Clube Mi Ozorio é ${codigo}. Ele vale por 10 minutos. Se não foi você, pode ignorar.`;
  if (evolutionConfigured()) {
    try {
      await sendEvolutionText(digits(phone), texto);
    } catch (e) {
      console.error("recuperacao: falha WhatsApp", e);
    }
  }
  if (c.email) {
    try {
      await sendClubRecoveryEmail(c.email, codigo);
    } catch (e) {
      console.error("recuperacao: falha e-mail", e);
    }
  }
  await recordAuth("cliente", "recover_request", ident, meta);
}

/**
 * Passo 2 — validação do código. Acerto emite o "vale" e libera a troca. Erro
 * incrementa tentativas (após 3, o código morre). Mensagem neutra.
 */
export async function validarCodigo(
  phoneRaw: string,
  code: string,
): Promise<RecupResult> {
  const meta = metaFromHeaders(headers());
  const phone = normalizeE164BR(phoneRaw);
  const GEN = { ok: false, message: "Código incorreto ou expirado." } as const;
  if (!phone || !/^\d{6}$/.test(code.trim())) return GEN;
  const ident = maskPhone(phone);

  const c = await prisma.customer.findUnique({ where: { phoneE164: phone } });
  if (!c) {
    await recordAuth("cliente", "recover_fail", ident, meta);
    return GEN;
  }
  const reset = await prisma.clubPasswordReset.findFirst({
    where: { customerId: c.id, usedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
  });
  if (!reset || reset.attempts >= MAX_ATTEMPTS) {
    await recordAuth("cliente", "recover_fail", ident, meta);
    return GEN;
  }

  if (!safeEqual(reset.codeHash, hashCode(code.trim()))) {
    const attempts = reset.attempts + 1;
    await prisma.clubPasswordReset.update({
      where: { id: reset.id },
      // Estourou as tentativas? Queima o código.
      data: {
        attempts,
        usedAt: attempts >= MAX_ATTEMPTS ? new Date() : null,
      },
    });
    await recordAuth("cliente", "recover_fail", ident, meta);
    return GEN;
  }

  // Acertou: emite o vale (não queima o código ainda — só na troca efetiva).
  setValeCookie(c.id);
  return { ok: true };
}

/**
 * Passo 3 — nova senha. Usa o "vale" (cookie) como autorização; nunca confia em
 * id vindo do form. Ao concluir: já loga a cliente (sessão normal).
 */
export async function redefinirSenhaComVale(
  newPassword: string,
): Promise<RecupResult> {
  const meta = metaFromHeaders(headers());
  const customerId = lerValeCookie();
  if (!customerId) {
    return { ok: false, message: "Seu código expirou. Peça um novo, por favor." };
  }
  if (newPassword.length < CLUB_MIN_SENHA) {
    return {
      ok: false,
      message: `A senha precisa de pelo menos ${CLUB_MIN_SENHA} caracteres.`,
    };
  }
  if (senhaFraca(newPassword)) {
    return { ok: false, message: "Escolha uma senha um pouco mais difícil 🤎" };
  }
  const c = await prisma.customer.findUnique({ where: { id: customerId } });
  if (!c) return { ok: false, message: "Conta não encontrada." };
  if (digits(newPassword) && digits(newPassword) === digits(c.phoneE164)) {
    return { ok: false, message: "Escolha uma senha diferente do seu telefone." };
  }

  await prisma.$transaction([
    prisma.customer.update({
      where: { id: c.id },
      data: {
        clubPasswordHash: bcrypt.hashSync(newPassword, 12),
        clubPasswordProvisoria: false,
        clubFailedLogins: 0,
        clubLockedUntil: null,
        clubConsentAt: c.clubConsentAt ?? new Date(),
      },
    }),
    // Queima qualquer código pendente desta cliente.
    prisma.clubPasswordReset.updateMany({
      where: { customerId: c.id, usedAt: null },
      data: { usedAt: new Date() },
    }),
  ]);

  limparValeCookie();
  iniciarSessaoCliente(c.id); // já entra logada
  await recordAuth("cliente", "recover_ok", maskPhone(c.phoneE164), meta);
  return { ok: true };
}
