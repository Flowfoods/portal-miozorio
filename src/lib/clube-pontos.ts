import { prisma } from "./prisma";
import { getSettings } from "./settings";
import { dispatchEvent } from "./notify";

/**
 * Clube por PONTOS (Anexo 1). Saldo = SUM(pontos) do extrato (club_transactions).
 * Ganha: por atendimento (service.clubPoints) e por indicação concretizada.
 * Resgata: recompensas do catálogo (débito). Tudo auditável no extrato.
 *
 * Antifraude (sec-audit-fraud-guard):
 *  - crédito automático é idempotente via dedup_key (service:<bookingId>,
 *    referral:<indicadaId>) — nunca credita duas vezes (R10).
 *  - indicação: nunca auto-indicação; ponto só quando a indicada realiza
 *    atendimento; uma vez por indicada (dedup).
 *  - resgate nunca deixa o saldo negativo.
 */

/** Função pura: saldo a partir das transações. */
export function saldoDe(txns: { pontos: number }[]): number {
  return txns.reduce((s, t) => s + t.pontos, 0);
}

interface CreditoInput {
  customerId: string;
  pontos: number;
  tipo: "service" | "referral" | "redemption" | "manual";
  descricao: string;
  dedupKey?: string;
}

/** Lança a transação. Retorna false se o dedup_key já existia (já creditado). */
async function lancar(input: CreditoInput): Promise<boolean> {
  try {
    await prisma.clubTransaction.create({
      data: {
        customerId: input.customerId,
        pontos: input.pontos,
        tipo: input.tipo,
        descricao: input.descricao,
        dedupKey: input.dedupKey ?? null,
      },
    });
    return true;
  } catch (e) {
    if (String((e as { code?: string })?.code).includes("P2002")) return false;
    throw e;
  }
}

/** Saldo atual de uma cliente. */
export async function saldoDoCliente(customerId: string): Promise<number> {
  const txns = await prisma.clubTransaction.findMany({
    where: { customerId },
    select: { pontos: true },
  });
  return saldoDe(txns);
}

/** Saldo + extrato (mais recente primeiro). */
export async function getSaldoExtrato(customerId: string) {
  const extrato = await prisma.clubTransaction.findMany({
    where: { customerId },
    orderBy: { createdAt: "desc" },
  });
  return { saldo: saldoDe(extrato), extrato };
}

/** Credita os pontos do serviço quando um atendimento é concluído (só membro). */
export async function creditarPontosServico(bookingId: string): Promise<void> {
  const b = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: {
      customerId: true,
      customer: { select: { clubJoinedAt: true } },
      service: { select: { name: true, clubPoints: true } },
    },
  });
  if (!b || !b.customer.clubJoinedAt || b.service.clubPoints <= 0) return;
  await lancar({
    customerId: b.customerId,
    pontos: b.service.clubPoints,
    tipo: "service",
    descricao: `Atendimento: ${b.service.name}`,
    dedupKey: `service:${bookingId}`,
  });
}

/**
 * Credita os pontos de indicação para a embaixadora quando a indicada realiza
 * um atendimento. Idempotente por indicada (dedup) e antifraude. Retorna a
 * embaixadora + pontos quando creditou AGORA (insumo do parabéns via n8n).
 */
export async function creditarPontosIndicacao(
  indicadaId: string,
): Promise<{ embaixadoraId: string; pontos: number } | null> {
  const indicada = await prisma.customer.findUnique({
    where: { id: indicadaId },
    select: { referredById: true },
  });
  if (!indicada?.referredById) return null;
  if (indicada.referredById === indicadaId) return null; // antifraude: auto-indicação

  const pontos = (await getSettings()).clubPointsPerReferral;
  if (pontos <= 0) return null;

  const creditou = await lancar({
    customerId: indicada.referredById,
    pontos,
    tipo: "referral",
    descricao: "Indicação concretizada 💛",
    dedupKey: `referral:${indicadaId}`,
  });
  if (!creditou) return null;

  // Parabéns via n8n (env-gated, idempotente). Falha não desfaz o crédito.
  const embaixadora = await prisma.customer.findUnique({
    where: { id: indicada.referredById },
    select: { name: true, phoneE164: true },
  });
  if (embaixadora) {
    await dispatchEvent({
      kind: "club_points",
      dedupKey: `club_points_referral:${indicadaId}`,
      data: {
        nome: embaixadora.name,
        telefone: embaixadora.phoneE164,
        pontos,
        motivo: "indicação",
      },
    });
  }
  return { embaixadoraId: indicada.referredById, pontos };
}

export interface ResgateResult {
  ok: boolean;
  message?: string;
}

/** Resgata uma recompensa do catálogo (débito). Nunca deixa saldo negativo. */
export async function resgatarRecompensa(
  customerId: string,
  rewardId: string,
): Promise<ResgateResult> {
  const reward = await prisma.clubReward.findUnique({ where: { id: rewardId } });
  if (!reward || !reward.ativo) {
    return { ok: false, message: "Recompensa indisponível." };
  }
  const saldo = await saldoDoCliente(customerId);
  if (saldo < reward.custoPontos) {
    return { ok: false, message: "Saldo insuficiente para esse resgate." };
  }
  await lancar({
    customerId,
    pontos: -reward.custoPontos,
    tipo: "redemption",
    descricao: `Resgate: ${reward.nome}`,
  });
  return { ok: true };
}

/** Ajuste manual de pontos pela Mi (cortesia ou correção). Vai ao extrato. */
export async function ajustarPontosManual(
  customerId: string,
  pontos: number,
  descricao: string,
): Promise<void> {
  if (pontos === 0) return;
  await lancar({ customerId, pontos, tipo: "manual", descricao });
}
