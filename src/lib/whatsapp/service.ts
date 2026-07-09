import { prisma } from "../prisma";
import { sendEvolutionText, evolutionConfigured } from "./evolution";

/**
 * WhatsAppService (Campanhas F1) — porta ÚNICA de saída para a Evolution.
 * Toda mensagem vira uma linha no outbox `whatsapp_message`: idempotência por
 * dedupeKey, retry com backoff, status consultável no admin.
 *
 *  - TRANSACIONAL (confirmação/lembrete/código): enfileira + envia na hora;
 *    se falhar, fica QUEUED e o worker reprocessa. Nunca bloqueado por opt-out.
 *  - CAMPANHA: enfileira; o worker drena com throttle e respeita aceitaMarketing.
 *
 * O núcleo de decisão é PURO (testável sem banco/rede): backoff, opt-out e a
 * detecção de "SAIR/PARAR".
 */

export type WaTipo = "TRANSACIONAL" | "CAMPANHA";
export const MAX_TENTATIVAS = 5;

// ── Núcleo puro ──────────────────────────────────────────────────────────────

/** Backoff exponencial a partir do nº de tentativas já feitas: 1,2,4,8,16 min (teto 1h). */
export function backoffMs(tentativas: number): number {
  const exp = Math.max(0, tentativas - 1);
  return Math.min(60_000 * 2 ** exp, 60 * 60_000);
}

/** CAMPANHA exige opt-in de marketing; TRANSACIONAL nunca é bloqueado. */
export function bloqueadaPorOptOut(tipo: string, aceitaMarketing: boolean): boolean {
  return tipo === "CAMPANHA" && !aceitaMarketing;
}

/** Detecta resposta de descadastro no WhatsApp ("SAIR", "PARAR"…). */
export function isOptOutReply(texto: string): boolean {
  const t = (texto ?? "").trim().toLowerCase().replace(/[.!]/g, "");
  return ["sair", "parar", "pare", "cancelar", "stop", "descadastrar"].includes(t);
}

/** Resultado de uma tentativa → próximo estado do outbox. */
export function proximoEstado(
  tentativasAntes: number,
  ok: boolean,
): { status: "SENT" | "QUEUED" | "FAILED"; proximaTentativa: Date | null } {
  if (ok) return { status: "SENT", proximaTentativa: null };
  const tentativas = tentativasAntes + 1;
  if (tentativas >= MAX_TENTATIVAS) return { status: "FAILED", proximaTentativa: null };
  return { status: "QUEUED", proximaTentativa: new Date(Date.now() + backoffMs(tentativas)) };
}

const digits = (s: string) => (s ?? "").replace(/\D/g, "");

// ── Enfileirar (idempotente) ─────────────────────────────────────────────────

export interface EnqueueInput {
  telefone: string;
  texto: string;
  dedupeKey: string;
  tipo: WaTipo;
  clienteId?: string | null;
  templateKey?: string | null;
  campanhaId?: string | null;
  payload?: unknown;
}

/** Cria a mensagem QUEUED. Se o dedupeKey já existe, devolve null (idempotência). */
export async function enqueue(input: EnqueueInput): Promise<string | null> {
  try {
    const m = await prisma.whatsAppMessage.create({
      data: {
        telefone: digits(input.telefone),
        texto: input.texto,
        dedupeKey: input.dedupeKey,
        tipo: input.tipo,
        clienteId: input.clienteId ?? null,
        templateKey: input.templateKey ?? null,
        campanhaId: input.campanhaId ?? null,
        payload: (input.payload as never) ?? undefined,
      },
      select: { id: true },
    });
    return m.id;
  } catch {
    return null; // unique(dedupeKey) → já enfileirado
  }
}

// ── Enviar uma mensagem do outbox ────────────────────────────────────────────

/**
 * Tenta enviar UMA mensagem (por id). Aplica opt-out (campanha), envia pela
 * Evolution e grava o novo status. Devolve true só se saiu. Best-effort.
 */
export async function tentarEnviar(id: string): Promise<boolean> {
  const msg = await prisma.whatsAppMessage.findUnique({ where: { id } });
  if (!msg || msg.status === "SENT" || msg.status === "DELIVERED") return true;
  if (msg.status === "OPTED_OUT" || msg.status === "FAILED") return false;

  // Opt-out só para campanha.
  if (msg.tipo === "CAMPANHA") {
    const cli = msg.clienteId
      ? await prisma.customer.findUnique({
          where: { id: msg.clienteId },
          select: { aceitaMarketing: true },
        })
      : null;
    const aceita = cli?.aceitaMarketing ?? true;
    if (bloqueadaPorOptOut(msg.tipo, aceita)) {
      await prisma.whatsAppMessage.update({
        where: { id },
        data: { status: "OPTED_OUT", erro: "cliente sem opt-in de marketing" },
      });
      return false;
    }
  }

  try {
    await sendEvolutionText(msg.telefone, msg.texto);
    await prisma.whatsAppMessage.update({
      where: { id },
      data: { status: "SENT", enviadoEm: new Date(), erro: null },
    });
    return true;
  } catch (e) {
    const prox = proximoEstado(msg.tentativas, false);
    await prisma.whatsAppMessage.update({
      where: { id },
      data: {
        status: prox.status,
        tentativas: msg.tentativas + 1,
        proximaTentativa: prox.proximaTentativa,
        erro: String(e).slice(0, 300),
      },
    });
    return false;
  }
}

/**
 * Envio TRANSACIONAL: enfileira e tenta enviar na hora. Idempotente pelo
 * dedupeKey. Devolve true se saiu (ou já tinha saído). Nunca lança.
 */
export async function sendTransactional(
  input: Omit<EnqueueInput, "tipo">,
): Promise<boolean> {
  if (!evolutionConfigured()) return false;
  const id = await enqueue({ ...input, tipo: "TRANSACIONAL" });
  if (!id) {
    // Duplicado: considera sucesso se a anterior já saiu.
    const ja = await prisma.whatsAppMessage.findUnique({
      where: { dedupeKey: input.dedupeKey },
      select: { status: true },
    });
    return ja?.status === "SENT" || ja?.status === "DELIVERED";
  }
  return tentarEnviar(id);
}

// ── Worker (retry + drenar campanha com throttle) ────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** Intervalo aleatório entre envios em lote (anti-ban). */
export function throttleDelayMs(minS = 8, maxS = 20): number {
  return Math.floor((minS + Math.random() * (maxS - minS)) * 1000);
}

export interface OutboxResumo {
  enviados: number;
  falhas: number;
  optOut: number;
  skipped?: string;
}

/**
 * Drena o outbox: retries devidos + campanhas QUEUED. Throttle só entre CAMPANHA
 * (transacional retry vai rápido). Lote limitado p/ não estourar o timeout.
 */
export async function dispatchOutbox(opts?: {
  limite?: number;
  throttle?: boolean;
}): Promise<OutboxResumo> {
  if (!evolutionConfigured()) {
    return { enviados: 0, falhas: 0, optOut: 0, skipped: "evolution-nao-configurada" };
  }
  const limite = opts?.limite ?? 15;
  const throttle = opts?.throttle ?? true;
  const agora = new Date();

  const msgs = await prisma.whatsAppMessage.findMany({
    where: {
      status: "QUEUED",
      OR: [{ proximaTentativa: null }, { proximaTentativa: { lte: agora } }],
    },
    orderBy: { criadoEm: "asc" },
    take: limite,
    select: { id: true, tipo: true },
  });

  const resumo: OutboxResumo = { enviados: 0, falhas: 0, optOut: 0 };
  for (let i = 0; i < msgs.length; i++) {
    const m = msgs[i]!;
    const ok = await tentarEnviar(m.id);
    if (ok) resumo.enviados++;
    else resumo.falhas++;
    // Throttle só depois de CAMPANHA e se ainda há próxima.
    if (throttle && m.tipo === "CAMPANHA" && i < msgs.length - 1) {
      await sleep(throttleDelayMs());
    }
  }
  return resumo;
}

// ── Webhook (status de entrega + opt-out) ────────────────────────────────────

/** ACK/entrega da Evolution → atualiza status (não rebaixa SENT→QUEUED). */
export async function registrarEntrega(
  telefone: string,
  entregue: boolean,
): Promise<void> {
  const tel = digits(telefone);
  const alvo = await prisma.whatsAppMessage.findFirst({
    where: { telefone: tel, status: { in: ["SENT", "QUEUED"] } },
    orderBy: { criadoEm: "desc" },
    select: { id: true },
  });
  if (!alvo) return;
  await prisma.whatsAppMessage.update({
    where: { id: alvo.id },
    data: { status: entregue ? "DELIVERED" : "FAILED" },
  });
}

/** "SAIR"/"PARAR" recebido → seta aceitaMarketing=false na cliente do telefone. */
export async function aplicarOptOut(telefone: string): Promise<void> {
  const tel = digits(telefone);
  await prisma.customer.updateMany({
    where: { phoneE164: { endsWith: tel.slice(-8) } },
    data: { aceitaMarketing: false, aceitaMarketingEm: new Date() },
  });
}
