import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies, headers } from "next/headers";
import bcrypt from "bcryptjs";
import { prisma } from "./prisma";
import { BCRYPT_ROUNDS, hashFraco, lockoutMs } from "./security";
import { EV, getSid, mergeAnonToClient, track } from "./tracking";
import {
  isIpThrottled,
  maskPhone,
  metaFromHeaders,
  recordAuth,
  throttlePorIdentificador,
} from "./authlog";
import {
  SENHA_MIN_CLIENTE,
  ehOProprioTelefone,
  normalizarSenha,
  normalizarTelefone,
} from "./auth-identidade";
import { TTL_SESSAO_CLIENTE_MS, opcoesCookie } from "./auth-cookies";
import { HEADER_CAMINHO, caminhoSeguro, loginComRetorno } from "./auth-rotas";

/**
 * Autenticação do PORTAL DO CLIENTE (Clube) — separada da do /admin (NextAuth).
 * Sessão = cookie httpOnly assinado por HMAC-SHA256 (segredo NEXTAUTH_SECRET).
 * Guarda o customerId, a flag de senha provisória e a versão do token; toda
 * query do portal filtra por esse id (isolamento — o cliente NUNCA passa id por
 * URL/payload).
 *
 * Senha inicial = telefone: enquanto `clubPasswordHash` é null e
 * `clubPasswordProvisoria` é true, o login compara contra os dígitos do telefone
 * e o portal força a troca antes de liberar qualquer dado.
 *
 * B1/B4 — a senha passa por `normalizarSenha` (trim só nas pontas) dos dois
 * lados e a versão do token (`clubTokenVersion`) derruba as demais sessões
 * quando a senha muda.
 */

const COOKIE = "mi_clube";
const TTL_MS = TTL_SESSAO_CLIENTE_MS; // 30 dias, renovados a cada ação
/** Mínimo da nova senha do cliente (portal de fidelidade, não admin). */
export const CLUB_MIN_SENHA = SENHA_MIN_CLIENTE;

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
  /** Versão do token da conta — troca de senha sobe e invalida os antigos. */
  tv: number;
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
    if (typeof p?.customerId !== "string" || typeof p?.exp !== "number")
      return null;
    if (p.exp < Date.now()) return null;
    return { ...p, tv: typeof p.tv === "number" ? p.tv : 0 };
  } catch {
    return null;
  }
}

function setCookie(session: ClienteSession): void {
  cookies().set(
    COOKIE,
    encode({ ...session, exp: Date.now() + TTL_MS }),
    opcoesCookie(TTL_MS),
  );
}

/**
 * Renovação deslizante: reemite o cookie com validade cheia. `cookies().set`
 * só é permitido em Server Action/Route Handler — durante o render de uma
 * página ele lança, e aí a sessão simplesmente segue com a validade que tinha
 * (renova na próxima ação da cliente).
 */
function renovarCookie(session: ClienteSession): void {
  try {
    setCookie(session);
  } catch {
    /* contexto de render: sem renovação agora, sem prejuízo */
  }
}

/**
 * Sessão da cliente logada (ou null). Nunca confia em id vindo do request.
 * Confere a versão do token no banco: trocar a senha derruba as outras sessões
 * (B4) e desativar o clube derruba todas.
 */
export async function getClienteSession(): Promise<ClienteSession | null> {
  const raw = cookies().get(COOKIE)?.value;
  if (!raw) return null;
  const d = decode(raw);
  if (!d) return null;

  const c = await prisma.customer
    .findUnique({
      where: { id: d.customerId },
      select: {
        clubJoinedAt: true,
        clubTokenVersion: true,
        clubPasswordProvisoria: true,
      },
    })
    .catch(() => null);
  if (!c || !c.clubJoinedAt || c.clubTokenVersion !== d.tv) return null;

  const sessao: ClienteSession = {
    customerId: d.customerId,
    // A flag vem do banco: se a senha foi definida noutro aparelho, esta sessão
    // não pode continuar achando que ainda é provisória.
    prov: c.clubPasswordProvisoria,
    tv: c.clubTokenVersion,
  };
  renovarCookie(sessao);
  return sessao;
}

export function logoutCliente(): void {
  cookies().set(COOKIE, "", { ...opcoesCookie(0), maxAge: 0 });
}

/**
 * B5 — link do login já com a página que a pessoa tentava abrir. Depois de
 * entrar ela volta exatamente para lá, em vez de cair sempre no início.
 * O caminho vem do header que o middleware injeta.
 */
export function hrefLoginCliente(): string {
  const caminho = headers().get(HEADER_CAMINHO);
  const destino = caminhoSeguro(caminho, "");
  return destino ? loginComRetorno("/clube/entrar", destino) : "/clube/entrar";
}

/**
 * Estabelece a sessão da cliente já com senha definitiva (prov=false). Usado
 * pela recuperação por WhatsApp e pelo login por passkey.
 */
export async function iniciarSessaoCliente(customerId: string): Promise<void> {
  const c = await prisma.customer.findUnique({
    where: { id: customerId },
    select: { clubTokenVersion: true, clubPasswordProvisoria: true },
  });
  setCookie({
    customerId,
    prov: c?.clubPasswordProvisoria ?? false,
    tv: c?.clubTokenVersion ?? 0,
  });
}

/** Sugestão de próximo passo para a UI mostrar o link certo (B1/B5). */
export type LoginSugestao = "cadastrar" | "recuperar" | "aguardar";

export type LoginResult =
  | { ok: true; mustChange: boolean }
  | { ok: false; message: string; sugestao?: LoginSugestao };

/** Dígitos puros (sem +/DDI duplicado) — base da senha provisória. */
function digits(s: string): string {
  return s.replace(/\D/g, "");
}

/** "Muitas tentativas" com o tempo real de espera (nunca bloqueio silencioso). */
function mensagemEspera(ate: Date | null): string {
  const min = ate
    ? Math.max(1, Math.ceil((ate.getTime() - Date.now()) / 60_000))
    : 15;
  return `Muitas tentativas seguidas. Tente de novo em ${min} min — ou peça um código novo para a Mi 💛`;
}

export async function loginCliente(
  phoneRaw: string,
  passwordRaw: string,
): Promise<LoginResult> {
  const phone = normalizarTelefone(phoneRaw);
  const password = normalizarSenha(passwordRaw);
  if (!phone) {
    return {
      ok: false,
      message: "Confere o WhatsApp? Use DDD + número.",
    };
  }
  if (!password) return { ok: false, message: "Digite sua senha." };

  const meta = metaFromHeaders(headers());
  const ident = maskPhone(phone);

  // Rate-limit por IP (defesa-em-profundidade além da trava por conta).
  if (await isIpThrottled(meta.ip)) {
    await recordAuth("cliente", "throttled", ident, meta);
    return { ok: false, message: mensagemEspera(null), sugestao: "aguardar" };
  }
  // B4 — rate-limit por IDENTIFICADOR: 10 falhas em 15 min pausam este
  // telefone, mesmo que venham de IPs diferentes. Com o tempo de espera na
  // tela — bloqueio silencioso deixa a cliente achando que o site quebrou.
  const porTelefone = await throttlePorIdentificador("cliente", ident);
  if (porTelefone.bloqueado) {
    await recordAuth("cliente", "throttled", ident, meta);
    return {
      ok: false,
      message: `Muitas tentativas nesse número. Tente de novo em ${porTelefone.minutos} min — ou peça um código para a Mi 💛`,
      sugestao: "aguardar",
    };
  }

  const c = await prisma.customer.findUnique({ where: { phoneE164: phone } });
  // Telefone desconhecido ou fora do Clube: a mensagem diz o que fazer em vez
  // de repetir "telefone ou senha incorretos" (B1/B5).
  if (!c || !c.clubJoinedAt) {
    await recordAuth("cliente", "login_fail", ident, meta);
    return {
      ok: false,
      message: "Não encontrei esse telefone por aqui. Quer se cadastrar?",
      sugestao: "cadastrar",
    };
  }

  if (c.clubLockedUntil && c.clubLockedUntil > new Date()) {
    await recordAuth("cliente", "locked", ident, meta);
    return {
      ok: false,
      message: mensagemEspera(c.clubLockedUntil),
      sugestao: "aguardar",
    };
  }

  // Senha provisória (1º acesso): compara contra os dígitos do telefone.
  const phoneDigits = digits(c.phoneE164);
  const provisoria = !c.clubPasswordHash && c.clubPasswordProvisoria;
  let valid = false;
  let reidratarHash = false;

  if (provisoria) {
    valid =
      digits(password) === phoneDigits ||
      digits(password) === phoneDigits.replace(/^55/, "");
  } else if (c.clubPasswordHash) {
    valid = bcrypt.compareSync(password, c.clubPasswordHash);
    // Hash antigo com custo menor que o atual? Regrava na hora certa — de
    // graça, sem pedir nada à cliente (B4).
    if (valid && hashFraco(c.clubPasswordHash)) reidratarHash = true;
    // Compatibilidade: senha cadastrada ANTES do trim (com espaço nas pontas)
    // continua entrando — e o hash é regravado já normalizado, para nunca mais
    // depender do espaço. Nenhuma senha existente é invalidada.
    if (!valid && passwordRaw !== password) {
      valid = bcrypt.compareSync(passwordRaw, c.clubPasswordHash);
      reidratarHash = valid;
    }
  }

  if (!valid) {
    const failed = c.clubFailedLogins + 1;
    const ms = lockoutMs(failed);
    const ate = ms > 0 ? new Date(Date.now() + ms) : c.clubLockedUntil;
    await prisma.customer.update({
      where: { id: c.id },
      data: { clubFailedLogins: failed, clubLockedUntil: ate },
    });
    await recordAuth("cliente", ms > 0 ? "locked" : "login_fail", ident, meta);
    return ms > 0
      ? { ok: false, message: mensagemEspera(ate), sugestao: "aguardar" }
      : {
          ok: false,
          message: "Senha incorreta. Se não lembrar, peça um código para a Mi.",
          sugestao: "recuperar",
        };
  }

  if (c.clubFailedLogins > 0 || c.clubLockedUntil || reidratarHash) {
    await prisma.customer.update({
      where: { id: c.id },
      data: {
        clubFailedLogins: 0,
        clubLockedUntil: null,
        ...(reidratarHash
          ? { clubPasswordHash: bcrypt.hashSync(password, BCRYPT_ROUNDS) }
          : {}),
      },
    });
  }

  setCookie({
    customerId: c.id,
    prov: c.clubPasswordProvisoria,
    tv: c.clubTokenVersion,
  });
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
 * LGPD na 1ª troca, sobe a versão do token (derruba as outras sessões — B4) e
 * renova o cookie DESTE aparelho já sem o flag provisório.
 */
export async function setClientePassword(
  newPasswordRaw: string,
  consent: boolean,
): Promise<SetPasswordResult> {
  const s = await getClienteSession();
  if (!s) return { ok: false, message: "Sessão expirada. Entre de novo." };
  const newPassword = normalizarSenha(newPasswordRaw);
  if (newPassword.length < CLUB_MIN_SENHA) {
    return {
      ok: false,
      message: `A senha precisa de pelo menos ${CLUB_MIN_SENHA} caracteres.`,
    };
  }
  const c = await prisma.customer.findUnique({ where: { id: s.customerId } });
  if (!c) return { ok: false, message: "Conta não encontrada." };
  if (c.clubPasswordProvisoria && !consent) {
    return {
      ok: false,
      message: "Para continuar, aceite a política de privacidade.",
    };
  }
  // Não deixar a nova senha ser o próprio telefone (continuaria adivinhável) —
  // com ou sem o DDI: "21998626845" é a senha provisória do primeiro acesso.
  if (ehOProprioTelefone(newPassword, c.phoneE164)) {
    return {
      ok: false,
      message: "Escolha uma senha diferente do seu telefone.",
    };
  }

  const atualizada = await prisma.customer.update({
    where: { id: c.id },
    data: {
      clubPasswordHash: bcrypt.hashSync(newPassword, BCRYPT_ROUNDS),
      clubPasswordProvisoria: false,
      clubFailedLogins: 0,
      clubLockedUntil: null,
      clubConsentAt: c.clubConsentAt ?? new Date(),
      clubTokenVersion: { increment: 1 },
    },
    select: { clubTokenVersion: true },
  });
  setCookie({
    customerId: c.id,
    prov: false,
    tv: atualizada.clubTokenVersion,
  });
  await recordAuth(
    "cliente",
    "password_changed",
    maskPhone(c.phoneE164),
    metaFromHeaders(headers()),
  );
  return { ok: true };
}
