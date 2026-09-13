import {
  createHash,
  randomBytes,
  randomInt,
  timingSafeEqual,
} from "node:crypto";
import { cookies, headers } from "next/headers";
import bcrypt from "bcryptjs";
import { DateTime } from "luxon";
import { prisma } from "./prisma";
import {
  RECUP_PADRAO_MINUTOS,
  getSettings,
  minutosValidadeCodigo,
} from "./settings";
import { formatPhoneBR, waLinkMsg } from "./format";
import { sendTransactional } from "./whatsapp/service";
import { BCRYPT_ROUNDS, MIN_SENHA, senhaFraca } from "./security";
import {
  ehOProprioTelefone,
  identificarLogin,
  normalizarSenha,
} from "./auth-identidade";
import { opcoesCookie } from "./auth-cookies";
import { CLUB_MIN_SENHA, iniciarSessaoCliente } from "./cliente-auth";
import { hashIp, maskPhone, metaFromHeaders, recordAuth } from "./authlog";

/**
 * RECUPERAÇÃO DE SENHA — módulo ÚNICO de todos os perfis do portal (B2).
 *
 * Modelo (decisão da Mi, vale para cliente e para o painel):
 *   1. a pessoa informa o telefone/e-mail cadastrado;
 *   2. o sistema gera um código de 6 dígitos e manda para o WhatsApp da MILENE,
 *      com nome, número cadastrado, perfil, prazo e o texto pronto para ela
 *      encaminhar;
 *   3. a Mi repassa o código para o número cadastrado da pessoa;
 *   4. a pessoa digita o código e cria a senha nova.
 *
 * Nunca enviamos código direto para número não cadastrado, e a resposta pública
 * é SEMPRE neutra — não revela se o identificador existe.
 *
 * Ciclo de vida (B3): o código vale 60 min (o repasse é manual); VERIFICAR o
 * código NÃO o consome — emite um token de troca de 15 min (cookie httpOnly em
 * `Path=/`, hash no banco) e só o SALVAR da senha marca `used_at`. Era aqui que
 * a cliente via "Código confirmado 💛" e, ao salvar, "Seu código expirou".
 */

// ── Parâmetros ───────────────────────────────────────────────────────────────
/**
 * Validade PADRÃO do código. Longa de propósito: quem repassa é gente, não
 * robô. A Mi pode mudar em Configurações (piso de 15 min — `RECUP_MIN_MINUTOS`).
 */
export const CODIGO_TTL_MS = RECUP_PADRAO_MINUTOS * 60_000;

/** Validade configurada pela Mi, em ms. Cai no padrão se o banco não responder. */
export async function ttlCodigoMs(): Promise<number> {
  const { recuperacaoCodigoMin } = await getSettings().catch(() => ({
    recuperacaoCodigoMin: RECUP_PADRAO_MINUTOS,
  }));
  return minutosValidadeCodigo(recuperacaoCodigoMin) * 60_000;
}
/** Janela entre "confirmei o código" e "salvei a senha nova". */
export const TROCA_TTL_MS = 15 * 60_000;
/** Tentativas de digitação do código antes de queimá-lo. */
export const MAX_TENTATIVAS = 5;
/** Cooldown entre pedidos da mesma pessoa (o botão da UI conta junto). */
export const COOLDOWN_MS = 60_000;
/** Teto de pedidos por hora no mesmo cadastro (B4) — a Mi não vira fila. */
export const MAX_PEDIDOS_HORA = 3;
const JANELA_PEDIDOS_MS = 60 * 60_000;

const COOKIE_TROCA = "mi_recuperacao";

/** Resposta pública do pedido — idêntica exista ou não a conta (anti-enumeração). */
export const RECUP_NEUTRO =
  "Se esse número estiver cadastrado, a Mi receberá o pedido e te manda o código pelo WhatsApp 💛";

export type Perfil = "cliente" | "admin";

// ── Utilidades ───────────────────────────────────────────────────────────────
function sha256(v: string): string {
  return createHash("sha256").update(v).digest("hex");
}
function comparaHash(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}
/** Código numérico de 6 dígitos, aleatório criptográfico. */
function gerarCodigo(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}
function gerarTokenTroca(): string {
  return randomBytes(32).toString("base64url");
}
function digitos(s: string): string {
  return s.replace(/\D/g, "");
}

/** "vale até 14:35" no fuso da Mi — a pessoa precisa da hora, não de "60 min". */
export async function horaLocal(d: Date): Promise<string> {
  const { timezone } = await getSettings().catch(() => ({
    timezone: "America/Sao_Paulo",
  }));
  return DateTime.fromJSDate(d).setZone(timezone).toFormat("HH:mm");
}

// ── Token de troca (cookie httpOnly, Path=/) ─────────────────────────────────
// Path=/ porque a MESMA tela de recuperação serve /clube e /admin. O bug antigo
// gravava o "vale" em Path=/clube e o apagava em Path=/ — ou seja, nunca
// apagava de verdade.
function gravarTroca(recoveryId: string, token: string): void {
  cookies().set(
    COOKIE_TROCA,
    `${recoveryId}.${token}`,
    opcoesCookie(TROCA_TTL_MS),
  );
}
function lerTroca(): { recoveryId: string; token: string } | null {
  const raw = cookies().get(COOKIE_TROCA)?.value;
  if (!raw) return null;
  const i = raw.indexOf(".");
  if (i <= 0) return null;
  return { recoveryId: raw.slice(0, i), token: raw.slice(i + 1) };
}
function limparTroca(): void {
  cookies().set(COOKIE_TROCA, "", { ...opcoesCookie(0), maxAge: 0 });
}

// ── Quem é a pessoa ──────────────────────────────────────────────────────────
interface Sujeito {
  perfil: Perfil;
  id: string;
  nome: string;
  /** Telefone E.164 (cliente) ou e-mail (painel) — é o que a Mi vê. */
  identificador: string;
}

/**
 * Encontra a dona do identificador. Telefone → cliente do Clube. E-mail →
 * conta do painel primeiro, depois cliente (a Mi também é cliente dela mesma).
 */
async function acharSujeito(identRaw: string): Promise<Sujeito | null> {
  const ident = identificarLogin(identRaw);
  if (!ident) return null;

  if (ident.tipo === "telefone") {
    const c = await prisma.customer.findUnique({
      where: { phoneE164: ident.valor },
      select: { id: true, name: true, phoneE164: true, clubJoinedAt: true },
    });
    if (!c || !c.clubJoinedAt) return null;
    return {
      perfil: "cliente",
      id: c.id,
      nome: c.name,
      identificador: c.phoneE164,
    };
  }

  const a = await prisma.adminUser.findUnique({
    where: { email: ident.valor },
    select: { id: true, name: true, email: true, active: true },
  });
  if (a?.active) {
    return {
      perfil: "admin",
      id: a.id,
      nome: a.name,
      identificador: a.email,
    };
  }

  const c = await prisma.customer.findFirst({
    where: { email: ident.valor, clubJoinedAt: { not: null } },
    select: { id: true, name: true, phoneE164: true },
  });
  if (!c) return null;
  return {
    perfil: "cliente",
    id: c.id,
    nome: c.name,
    identificador: c.phoneE164,
  };
}

/** Identificador seguro para o auth_log: telefone mascarado, e-mail inteiro. */
function paraLog(s: Sujeito): string {
  return s.perfil === "cliente" ? maskPhone(s.identificador) : s.identificador;
}

/** A auditoria separa os dois portais — pedido do painel não vira "cliente". */
function areaDe(perfil: Perfil): "admin" | "cliente" {
  return perfil === "admin" ? "admin" : "cliente";
}

// ── Aviso para a Mi ──────────────────────────────────────────────────────────
/** WhatsApp principal da Mi + contato de emergência (se o principal cair). */
export function numerosDaMi(): string[] {
  const brutos = [process.env.MI_WHATSAPP, process.env.MI_WHATSAPP_EMERGENCIA];
  return brutos.map((n) => digitos(n ?? "")).filter((n) => n.length >= 12);
}

/** Texto que a Mi recebe: contexto + código + a mensagem pronta p/ encaminhar. */
export function textoParaMi(input: {
  nome: string;
  perfil: Perfil;
  identificadorVisivel: string;
  codigo: string;
  ate: string;
}): string {
  const quem =
    input.perfil === "cliente" ? "cliente do Clube" : "acesso ao painel";
  return [
    "Oi, Mi 💛",
    "",
    `${input.nome} pediu para recuperar a senha (${quem}).`,
    `Cadastro: ${input.identificadorVisivel}`,
    "",
    `Código: ${input.codigo}`,
    `Vale até ${input.ate}.`,
    "",
    "É só encaminhar a mensagem abaixo para ela:",
    "— — — — —",
    textoParaPessoa(input.nome, input.codigo, input.ate),
  ].join("\n");
}

/** Mensagem pronta, na voz da Mi, para ela repassar sem reescrever nada. */
export function textoParaPessoa(
  nome: string,
  codigo: string,
  ate: string,
): string {
  const primeiro = nome.trim().split(/\s+/)[0] ?? nome;
  return `Oi, ${primeiro}! Seu código para criar a senha nova é ${codigo} 💛 Ele vale até as ${ate}. É só digitar na tela que você já está.`;
}

/** Link wa.me para a Mi mandar o código direto pela conversa da cliente. */
export function linkParaCliente(
  telefoneE164: string,
  nome: string,
  codigo: string,
  ate: string,
): string {
  return waLinkMsg(telefoneE164, textoParaPessoa(nome, codigo, ate));
}

// ── Passo 1 — pedir o código ─────────────────────────────────────────────────
/**
 * Pedido público. NUNCA devolve informação: a UI avança para o passo do código
 * exista ou não a conta. Falha da Evolution não quebra o fluxo — o pedido fica
 * registrado em `password_recoveries` (com o erro) e na fila do outbox.
 */
export async function pedirCodigo(identRaw: string): Promise<void> {
  const meta = metaFromHeaders(headers());
  const sujeito = await acharSujeito(identRaw);
  if (!sujeito) return; // neutro

  // Cooldown: pedido repetido em menos de 60s não gera código novo.
  const recente = await prisma.passwordRecovery.findFirst({
    where: { perfil: sujeito.perfil, subjectId: sujeito.id, usedAt: null },
    orderBy: { createdAt: "desc" },
  });
  if (recente && Date.now() - recente.lastSentAt.getTime() < COOLDOWN_MS)
    return;

  // B4 — teto de 3 pedidos por hora no mesmo cadastro. Silencioso de propósito:
  // qualquer aviso diferente aqui viraria um jeito de descobrir se o telefone
  // existe. Quem está de boa-fé vê o contador de 60s do botão na tela.
  const naHora = await prisma.passwordRecovery.count({
    where: {
      perfil: sujeito.perfil,
      subjectId: sujeito.id,
      origem: "publico",
      createdAt: { gte: new Date(Date.now() - JANELA_PEDIDOS_MS) },
    },
  });
  if (naHora >= MAX_PEDIDOS_HORA) {
    await recordAuth(
      areaDe(sujeito.perfil),
      "throttled",
      paraLog(sujeito),
      meta,
    );
    return;
  }

  await criarEAvisar(sujeito, meta, "publico");
}

interface MetaReq {
  ip?: string | null;
  userAgent?: string | null;
}

/** Cria o código, invalida os anteriores e avisa a Mi. Uso interno. */
async function criarEAvisar(
  sujeito: Sujeito,
  meta: MetaReq,
  origem: "publico" | "admin",
): Promise<{ codigo: string; expiresAt: Date; ate: string; id: string }> {
  // Pedir um código novo invalida os anteriores da mesma pessoa (B3).
  await prisma.passwordRecovery.updateMany({
    where: { perfil: sujeito.perfil, subjectId: sujeito.id, usedAt: null },
    data: { usedAt: new Date() },
  });

  const codigo = gerarCodigo();
  const expiresAt = new Date(Date.now() + (await ttlCodigoMs()));
  const row = await prisma.passwordRecovery.create({
    data: {
      perfil: sujeito.perfil,
      subjectId: sujeito.id,
      identificador: sujeito.identificador,
      codeHash: sha256(codigo),
      expiresAt,
      origem,
      ipHash: meta.ip ? hashIp(meta.ip) : null,
      userAgent: meta.userAgent?.slice(0, 400) ?? null,
    },
    select: { id: true },
  });

  const ate = await horaLocal(expiresAt);
  await recordAuth(
    areaDe(sujeito.perfil),
    "recover_request",
    paraLog(sujeito),
    meta,
  );

  if (origem === "publico") {
    await avisarMi(row.id, sujeito, codigo, ate);
  } else {
    // A Mi gerou pelo painel: ela já está vendo o código na tela.
    await prisma.passwordRecovery.update({
      where: { id: row.id },
      data: { notifiedAt: new Date() },
    });
  }

  return { codigo, expiresAt, ate, id: row.id };
}

/**
 * Manda o código para o WhatsApp da Mi (e para o contato de emergência, se
 * houver). Vai pelo outbox — idempotente por `dedupeKey`, com retry e status
 * consultável. Best-effort: erro nunca chega na tela da cliente.
 */
async function avisarMi(
  recoveryId: string,
  sujeito: Sujeito,
  codigo: string,
  ate: string,
): Promise<void> {
  const destinos = numerosDaMi();
  const visivel =
    sujeito.perfil === "cliente"
      ? formatPhoneBR(sujeito.identificador)
      : sujeito.identificador;
  const texto = textoParaMi({
    nome: sujeito.nome,
    perfil: sujeito.perfil,
    identificadorVisivel: visivel,
    codigo,
    ate,
  });

  if (destinos.length === 0) {
    await marcarAviso(recoveryId, false, "MI_WHATSAPP não configurado");
    return;
  }

  let algumFoi = false;
  const erros: string[] = [];
  for (let i = 0; i < destinos.length; i++) {
    const numero = destinos[i]!;
    try {
      const ok = await sendTransactional({
        telefone: numero,
        texto,
        dedupeKey: `recuperacao:${recoveryId}:${i}`,
        templateKey: "auth_recuperacao",
      });
      algumFoi = algumFoi || ok;
      if (!ok) erros.push(`destino ${i}: na fila para reenvio`);
    } catch (e) {
      erros.push(`destino ${i}: ${String(e).slice(0, 120)}`);
    }
  }
  await marcarAviso(recoveryId, algumFoi, erros.join(" · ") || null);
}

async function marcarAviso(
  id: string,
  ok: boolean,
  erro: string | null,
): Promise<void> {
  await prisma.passwordRecovery
    .update({
      where: { id },
      data: { notifiedAt: ok ? new Date() : null, notifyError: erro },
    })
    .catch(() => {
      /* auditoria é best-effort: nunca derruba o pedido */
    });
}

// ── Passo 2 — verificar o código ─────────────────────────────────────────────
export type VerificarResult =
  | { ok: true }
  | { ok: false; message: string; pedirNovo?: boolean };

/**
 * Confere o código e emite o token de troca. NÃO consome o código: ele só morre
 * quando a senha nova é salva (B3). Máx. 5 tentativas por código.
 */
export async function verificarCodigo(
  identRaw: string,
  codeRaw: string,
): Promise<VerificarResult> {
  const meta = metaFromHeaders(headers());
  const code = digitos(codeRaw ?? "").slice(0, 6);
  const sujeito = await acharSujeito(identRaw);
  const ERRADO: VerificarResult = {
    ok: false,
    message: "Código incorreto. Confere os 6 números?",
  };
  if (!sujeito || code.length !== 6) return ERRADO;

  const reset = await prisma.passwordRecovery.findFirst({
    where: { perfil: sujeito.perfil, subjectId: sujeito.id, usedAt: null },
    orderBy: { createdAt: "desc" },
  });
  if (!reset) {
    await recordAuth(
      areaDe(sujeito.perfil),
      "recover_fail",
      paraLog(sujeito),
      meta,
    );
    return {
      ok: false,
      message: "Não encontrei um código ativo. Peça um novo 💛",
      pedirNovo: true,
    };
  }
  if (reset.expiresAt <= new Date()) {
    await recordAuth(
      areaDe(sujeito.perfil),
      "recover_fail",
      paraLog(sujeito),
      meta,
    );
    return {
      ok: false,
      message: `Seu código venceu às ${await horaLocal(reset.expiresAt)}. Peça um novo 💛`,
      pedirNovo: true,
    };
  }
  if (reset.attempts >= MAX_TENTATIVAS) {
    await recordAuth(
      areaDe(sujeito.perfil),
      "recover_fail",
      paraLog(sujeito),
      meta,
    );
    return {
      ok: false,
      message: "Tentativas demais nesse código. Peça um novo 💛",
      pedirNovo: true,
    };
  }

  if (!comparaHash(reset.codeHash, sha256(code))) {
    const attempts = reset.attempts + 1;
    await prisma.passwordRecovery.update({
      where: { id: reset.id },
      // Estourou as tentativas? Queima o código.
      data: {
        attempts,
        usedAt: attempts >= MAX_TENTATIVAS ? new Date() : null,
      },
    });
    await recordAuth(
      areaDe(sujeito.perfil),
      "recover_fail",
      paraLog(sujeito),
      meta,
    );
    const restam = MAX_TENTATIVAS - attempts;
    return restam > 0
      ? {
          ok: false,
          message: `Código incorreto. Você ainda pode tentar ${restam} ${restam === 1 ? "vez" : "vezes"}.`,
        }
      : {
          ok: false,
          message: "Tentativas demais nesse código. Peça um novo 💛",
          pedirNovo: true,
        };
  }

  // Acertou: emite o token de troca (15 min) e deixa o código vivo até a senha
  // ser salva de fato.
  const token = gerarTokenTroca();
  await prisma.passwordRecovery.update({
    where: { id: reset.id },
    data: {
      attempts: 0,
      exchangeHash: sha256(token),
      exchangeExpiresAt: new Date(Date.now() + TROCA_TTL_MS),
    },
  });
  gravarTroca(reset.id, token);
  return { ok: true };
}

// ── Passo 3 — salvar a senha nova ────────────────────────────────────────────
export type SalvarResult =
  | { ok: true; perfil: Perfil; email: string | null }
  | { ok: false; message: string; pedirNovo?: boolean };

/**
 * Troca a senha usando o token emitido no passo 2 — a pessoa não digita o
 * código de novo. Consome o código (`used_at`), sobe a versão do token da conta
 * (derruba as outras sessões) e, no caso da cliente, já entra logada.
 */
export async function salvarNovaSenha(novaRaw: string): Promise<SalvarResult> {
  const meta = metaFromHeaders(headers());
  const troca = lerTroca();
  if (!troca) {
    return {
      ok: false,
      message: "Sua confirmação venceu. Peça um código novo 💛",
      pedirNovo: true,
    };
  }

  const reset = await prisma.passwordRecovery
    .findUnique({ where: { id: troca.recoveryId } })
    .catch(() => null);
  if (
    !reset ||
    reset.usedAt ||
    !reset.exchangeHash ||
    !reset.exchangeExpiresAt ||
    reset.exchangeExpiresAt <= new Date() ||
    !comparaHash(reset.exchangeHash, sha256(troca.token))
  ) {
    limparTroca();
    const quando = reset?.exchangeExpiresAt
      ? ` às ${await horaLocal(reset.exchangeExpiresAt)}`
      : "";
    return {
      ok: false,
      message: `Sua confirmação venceu${quando}. Peça um código novo 💛`,
      pedirNovo: true,
    };
  }

  const nova = normalizarSenha(novaRaw);
  const perfil = reset.perfil as Perfil;

  if (perfil === "admin") {
    const erro = await trocarSenhaAdmin(reset.subjectId, nova);
    if (erro) return { ok: false, message: erro };
  } else {
    const erro = await trocarSenhaCliente(reset.subjectId, nova);
    if (erro) return { ok: false, message: erro };
  }

  await prisma.passwordRecovery.updateMany({
    where: { perfil, subjectId: reset.subjectId, usedAt: null },
    data: { usedAt: new Date(), exchangeHash: null, exchangeExpiresAt: null },
  });
  limparTroca();

  await recordAuth(
    areaDe(perfil),
    "recover_ok",
    perfil === "admin" ? reset.identificador : maskPhone(reset.identificador),
    meta,
  );

  if (perfil === "cliente") {
    await iniciarSessaoCliente(reset.subjectId); // já entra logada
    return { ok: true, perfil, email: null };
  }
  return { ok: true, perfil, email: reset.identificador };
}

/** Regras da senha da cliente. Devolve a mensagem de erro, ou null se está ok. */
async function trocarSenhaCliente(
  customerId: string,
  nova: string,
): Promise<string | null> {
  if (nova.length < CLUB_MIN_SENHA) {
    return `A senha precisa de pelo menos ${CLUB_MIN_SENHA} caracteres.`;
  }
  const c = await prisma.customer.findUnique({ where: { id: customerId } });
  if (!c) return "Conta não encontrada.";
  if (ehOProprioTelefone(nova, c.phoneE164)) {
    return "Escolha uma senha diferente do seu telefone.";
  }
  await prisma.customer.update({
    where: { id: c.id },
    data: {
      clubPasswordHash: bcrypt.hashSync(nova, BCRYPT_ROUNDS),
      clubPasswordProvisoria: false,
      clubFailedLogins: 0,
      clubLockedUntil: null,
      clubConsentAt: c.clubConsentAt ?? new Date(),
      // Derruba as sessões abertas nos outros aparelhos (B4).
      clubTokenVersion: { increment: 1 },
    },
  });
  return null;
}

/** Regras da senha do painel (mais dura — acesso privilegiado). */
async function trocarSenhaAdmin(
  adminUserId: string,
  nova: string,
): Promise<string | null> {
  if (nova.length < MIN_SENHA) {
    return `A senha precisa de pelo menos ${MIN_SENHA} caracteres.`;
  }
  if (senhaFraca(nova)) {
    return "Essa senha é fácil de adivinhar. Escolha outra 🤎";
  }
  const u = await prisma.adminUser.findUnique({ where: { id: adminUserId } });
  if (!u || !u.active) return "Conta não encontrada.";
  await prisma.adminUser.update({
    where: { id: u.id },
    data: {
      passwordHash: bcrypt.hashSync(nova, BCRYPT_ROUNDS),
      failedAttempts: 0,
      lockedUntil: null,
      tokenVersion: { increment: 1 },
    },
  });
  return null;
}

// ── Painel: a Mi gera o código pela ficha da cliente ─────────────────────────
export interface CodigoDoAdmin {
  codigo: string;
  /** "14:35" — até que horas o código vale, no fuso da Mi. */
  ate: string;
  nome: string;
  /** Telefone formatado para a Mi conferir antes de mandar. */
  telefoneVisivel: string;
  /** wa.me da cliente com a mensagem pronta. */
  link: string;
}

/**
 * Gera um código para a cliente selecionada e devolve tudo pronto na tela da
 * Mi: o código, até que horas vale e o link para mandar pelo WhatsApp DELA.
 * Mesma tabela e mesmas regras do fluxo público — só a origem muda.
 * Chamado de server action que já passou por `requireAdmin()`.
 */
export async function gerarCodigoParaCliente(
  customerId: string,
): Promise<CodigoDoAdmin | null> {
  const c = await prisma.customer
    .findUnique({
      where: { id: customerId },
      select: { id: true, name: true, phoneE164: true, clubJoinedAt: true },
    })
    .catch(() => null);
  if (!c || !c.clubJoinedAt) return null;

  const sujeito: Sujeito = {
    perfil: "cliente",
    id: c.id,
    nome: c.name,
    identificador: c.phoneE164,
  };
  const { codigo, ate } = await criarEAvisar(
    sujeito,
    metaFromHeaders(headers()),
    "admin",
  );
  return {
    codigo,
    ate,
    nome: c.name,
    telefoneVisivel: formatPhoneBR(c.phoneE164),
    link: linkParaCliente(c.phoneE164, c.name, codigo, ate),
  };
}
