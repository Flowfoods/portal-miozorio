import { randomBytes } from "node:crypto";
import { prisma } from "./prisma";
import { getSettings, type ReferralScope } from "./settings";
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

/**
 * Motivo do bônus de indicação PERCENTUAL (novo). O motivo antigo "referral"
 * (pontuação fixa) permanece só como legado de leitura no histórico (R: migração).
 */
export const MOTIVO_INDICACAO_PCT = "indicacao_percentual";

/** Função pura: saldo a partir das transações. */
export function saldoDe(txns: { pontos: number }[]): number {
  return txns.reduce((s, t) => s + t.pontos, 0);
}

/**
 * Bônus percentual da indicação — função PURA (testável sem banco).
 * Base = pontos que a indicada ganhou NAQUELE atendimento.
 * Regra de arredondamento: `floor` (para baixo) até inteiro; PISO de 1 ponto
 * quando o cálculo resulta > 0 e < 1 (a indicadora nunca sai com zero de um
 * atendimento válido que pontuou). Percentual é clampado em [0, 100].
 */
export function calcularBonusIndicacao(
  base: number,
  percentual: number,
): number {
  if (base <= 0) return 0;
  const pct = Math.min(100, Math.max(0, percentual));
  const bruto = (base * pct) / 100;
  if (bruto <= 0) return 0;
  return bruto < 1 ? 1 : Math.floor(bruto);
}

/** Primeiro nome para a UX do extrato/WhatsApp ("Indicação: Ana se cuidou..."). */
function primeiroNome(nome: string): string {
  const p = nome.trim().split(/\s+/)[0];
  return p && p.length > 0 ? p : nome.trim();
}

/**
 * Antifraude PURO (sec-audit-fraud-guard): bloqueia autoindicação quando
 * indicada e embaixadora são a mesma pessoa por clientId, telefone ou e-mail.
 */
export function ehAutoindicacao(a: {
  indicadaId: string;
  embaixadoraId: string;
  indicadaPhone?: string | null;
  embaixadoraPhone?: string | null;
  indicadaEmail?: string | null;
  embaixadoraEmail?: string | null;
}): boolean {
  if (a.indicadaId === a.embaixadoraId) return true;
  if (
    a.indicadaPhone &&
    a.embaixadoraPhone &&
    a.indicadaPhone === a.embaixadoraPhone
  )
    return true;
  const e1 = a.indicadaEmail?.trim().toLowerCase();
  const e2 = a.embaixadoraEmail?.trim().toLowerCase();
  if (e1 && e2 && e1 === e2) return true;
  return false;
}

/**
 * Escopo PURO: PRIMEIRO_ATENDIMENTO só credita se a indicada ainda não gerou
 * bônus (novo OU legado fixo). TODOS_ATENDIMENTOS credita sempre.
 */
export function escopoPermiteBonus(
  escopo: ReferralScope,
  jaPago: boolean,
): boolean {
  return escopo === "PRIMEIRO_ATENDIMENTO" ? !jaPago : true;
}

interface CreditoInput {
  customerId: string;
  pontos: number;
  tipo:
    | "service"
    | "referral"
    | typeof MOTIVO_INDICACAO_PCT
    | "redemption"
    | "manual"
    | "depoimento"
    | "foto"
    | "reagendamento";
  descricao: string;
  dedupKey?: string;
  /** Snapshot auditável (percentual, base, bookingId, indicadaId, estorno…). */
  meta?: Record<string, unknown>;
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
        meta: (input.meta ?? undefined) as never,
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
 * Credita o bônus de indicação PERCENTUAL para a embaixadora quando a indicada
 * conclui um atendimento e pontua. Regra nova (substitui a pontuação fixa):
 * embaixadora ganha `floor(pontos_da_indicada × percentual)` daquele atendimento.
 *
 * Integridade (sec-audit-fraud-guard):
 *  - Gatilho é a conclusão do atendimento (chamada em markCompleted), nunca
 *    cadastro/agendamento.
 *  - Base = SÓ os pontos que a indicada ganhou NESTE atendimento (service.clubPoints
 *    se membro); não inclui depoimento/foto/bônus/resgate/saldo.
 *  - Idempotência por atendimento: dedup `indicacao_pct:<bookingId>` (constraint
 *    única) — reprocessar o mesmo evento nunca duplica.
 *  - Snapshot no lançamento: percentual vigente, base, bookingId, indicadaId.
 *  - Antifraude: bloqueia auto-indicação (mesmo clientId / telefone / e-mail).
 *  - Escopo PRIMEIRO_ATENDIMENTO vs TODOS_ATENDIMENTOS e liga/desliga do programa.
 *  - Migração: `referral:<indicadaId>` legado conta como bônus já pago no escopo
 *    PRIMEIRO_ATENDIMENTO; créditos históricos ficam intocados.
 *
 * Retorna a embaixadora + pontos quando creditou AGORA (insumo do parabéns n8n).
 */
export async function creditarPontosIndicacao(
  indicadaId: string,
  bookingId: string,
): Promise<{
  embaixadoraId: string;
  pontos: number;
  indicadaNome: string;
} | null> {
  const settings = await getSettings();
  if (!settings.clubReferralActive) return null; // programa desligado (R3), vínculos preservados

  const indicada = await prisma.customer.findUnique({
    where: { id: indicadaId },
    select: { name: true, email: true, phoneE164: true, referredById: true },
  });
  if (!indicada?.referredById) return null;
  const embaixadoraId = indicada.referredById;

  // Base de cálculo: apenas os pontos deste atendimento (service.clubPoints),
  // e só se a indicada é membro do Clube — igual a creditarPontosServico.
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: {
      customerId: true,
      customer: { select: { clubJoinedAt: true } },
      service: { select: { clubPoints: true } },
    },
  });
  if (!booking || booking.customerId !== indicadaId) return null;
  const base =
    booking.customer.clubJoinedAt && booking.service.clubPoints > 0
      ? booking.service.clubPoints
      : 0;
  if (base <= 0) return null;

  const embaixadora = await prisma.customer.findUnique({
    where: { id: embaixadoraId },
    select: { name: true, phoneE164: true, email: true },
  });
  if (!embaixadora) return null;

  // Antifraude: bloqueia autoindicação (clientId/telefone/e-mail coincidentes).
  if (
    ehAutoindicacao({
      indicadaId,
      embaixadoraId,
      indicadaPhone: indicada.phoneE164,
      embaixadoraPhone: embaixadora.phoneE164,
      indicadaEmail: indicada.email,
      embaixadoraEmail: embaixadora.email,
    })
  )
    return null;

  // Escopo PRIMEIRO_ATENDIMENTO: só o 1º atendimento concluído da indicada gera
  // bônus. Conta o novo motivo E o legado fixo já pago (migração da regra antiga).
  const jaPago = !!(await prisma.clubTransaction.findFirst({
    where: {
      customerId: embaixadoraId,
      OR: [
        { dedupKey: `referral:${indicadaId}` }, // legado fixo
        {
          tipo: MOTIVO_INDICACAO_PCT,
          pontos: { gt: 0 },
          meta: { path: ["indicadaId"], equals: indicadaId },
        },
      ],
    },
    select: { id: true },
  }));
  if (!escopoPermiteBonus(settings.clubReferralScope, jaPago)) return null;

  const pontos = calcularBonusIndicacao(base, settings.clubReferralPercent);
  if (pontos <= 0) return null;

  const creditou = await lancar({
    customerId: embaixadoraId,
    pontos,
    tipo: MOTIVO_INDICACAO_PCT,
    // Extrato (UX): "Indicação: {primeiro nome} se cuidou com a Mi · +X pts".
    descricao: `Indicação: ${primeiroNome(indicada.name)} se cuidou com a Mi`,
    // Idempotência por atendimento concluído (bookingId + motivo).
    dedupKey: `indicacao_pct:${bookingId}`,
    // Snapshot vigente no momento — auditável ponta a ponta.
    meta: {
      motivo: "INDICACAO_PERCENTUAL",
      percentual: settings.clubReferralPercent,
      base,
      bookingId,
      indicadaId,
    },
  });
  if (!creditou) return null;

  // Parabéns via n8n (env-gated, idempotente). Falha NÃO desfaz o crédito.
  const saldo = await saldoDoCliente(embaixadoraId);
  await dispatchEvent({
    kind: "club_points",
    dedupKey: `club_points_indicacao:${bookingId}`,
    data: {
      nome: embaixadora.name,
      telefone: embaixadora.phoneE164,
      pontos,
      saldo,
      amigaNome: primeiroNome(indicada.name),
      motivo: "indicação",
    },
  });

  return {
    embaixadoraId,
    pontos,
    indicadaNome: primeiroNome(indicada.name),
  };
}

/**
 * Estorno espelhado (R: estorno). Se um atendimento concluído da indicada for
 * revertido, os pontos do serviço dela E o bônus percentual da embaixadora são
 * revertidos por LANÇAMENTO NEGATIVO ESPELHADO — nunca por deleção (extrato
 * imutável e auditável). Idempotente: cada estorno tem dedup próprio e só
 * reverte o crédito que existe e ainda não foi estornado.
 */
export async function reverterCreditosDeBooking(
  bookingId: string,
): Promise<void> {
  // (1) pontos do serviço da própria cliente
  const servico = await prisma.clubTransaction.findUnique({
    where: { dedupKey: `service:${bookingId}` },
  });
  if (servico && servico.pontos > 0) {
    await lancar({
      customerId: servico.customerId,
      pontos: -servico.pontos,
      tipo: "service",
      descricao: `Estorno — ${servico.descricao}`,
      dedupKey: `estorno_service:${bookingId}`,
      meta: { motivo: "ESTORNO", origem: servico.id, bookingId },
    });
  }

  // (2) bônus de indicação percentual da embaixadora
  const indic = await prisma.clubTransaction.findUnique({
    where: { dedupKey: `indicacao_pct:${bookingId}` },
  });
  if (indic && indic.pontos > 0) {
    await lancar({
      customerId: indic.customerId,
      pontos: -indic.pontos,
      tipo: MOTIVO_INDICACAO_PCT,
      descricao: `Estorno — ${indic.descricao}`,
      dedupKey: `estorno_indicacao_pct:${bookingId}`,
      meta: { motivo: "ESTORNO", origem: indic.id, bookingId },
    });
  }
}

/**
 * Bônus de reagendamento (F5): creditado quando um atendimento agendado pela
 * Área da Cliente (source=area_cliente) é concluído. Configurável em
 * business_settings (club_points_reagendamento), default 0 = desligado (R3).
 * Idempotente por booking (dedup reagendamento:<bookingId>). Só para membro.
 */
export async function creditarBonusReagendamento(
  bookingId: string,
  customerId: string,
): Promise<void> {
  const pontos = (await getSettings()).clubPointsReagendamento;
  if (pontos <= 0) return;
  const membro = await prisma.customer.findUnique({
    where: { id: customerId },
    select: { clubJoinedAt: true },
  });
  if (!membro?.clubJoinedAt) return;
  await lancar({
    customerId,
    pontos,
    tipo: "reagendamento",
    descricao: "Bônus por voltar 💛",
    dedupKey: `reagendamento:${bookingId}`,
  });
}

export interface ResgateResult {
  ok: boolean;
  message?: string;
  codigo?: string;
}

// Sem 0/O/1/I — código curto ditado/lido no balcão.
const VOUCHER_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
function gerarVoucherCodigo(): string {
  const bytes = randomBytes(6);
  let s = "";
  for (let i = 0; i < 6; i++)
    s += VOUCHER_ALPHABET[bytes[i]! % VOUCHER_ALPHABET.length];
  return `MI-${s}`;
}

/**
 * Resgata uma recompensa do catálogo: débito no ledger + voucher (código +
 * status). Transação SERIALIZABLE recalcula o saldo dentro da tx — sem saldo
 * negativo e sem double-spend em corrida. Idempotência não se aplica (cada
 * resgate é um ato deliberado distinto). Reusado pelo cliente e pelo admin.
 */
export async function resgatarRecompensa(
  customerId: string,
  rewardId: string,
): Promise<ResgateResult> {
  const reward = await prisma.clubReward.findUnique({
    where: { id: rewardId },
  });
  if (!reward || !reward.ativo) {
    return { ok: false, message: "Recompensa indisponível." };
  }
  const codigo = gerarVoucherCodigo();
  try {
    const ok = await prisma.$transaction(
      async (tx) => {
        const agg = await tx.clubTransaction.aggregate({
          where: { customerId },
          _sum: { pontos: true },
        });
        const saldo = agg._sum.pontos ?? 0;
        if (saldo < reward.custoPontos) return false;
        await tx.clubTransaction.create({
          data: {
            customerId,
            pontos: -reward.custoPontos,
            tipo: "redemption",
            descricao: `Resgate: ${reward.nome}`,
          },
        });
        await tx.clubVoucher.create({
          data: {
            customerId,
            rewardId: reward.id,
            rewardNome: reward.nome,
            custoPontos: reward.custoPontos,
            codigo,
          },
        });
        return true;
      },
      { isolationLevel: "Serializable" },
    );
    if (!ok)
      return { ok: false, message: "Saldo insuficiente para esse resgate." };
    return { ok: true, codigo };
  } catch {
    // Falha de serialização (corrida) ou código duplicado: pedir nova tentativa.
    return {
      ok: false,
      message: "Não consegui concluir agora. Tente de novo.",
    };
  }
}

/** Mi marca um voucher como entregue (idempotente; só sai de 'solicitado'). */
export async function marcarVoucherEntregue(
  voucherId: string,
): Promise<boolean> {
  const v = await prisma.clubVoucher.findUnique({ where: { id: voucherId } });
  if (!v || v.status !== "solicitado") return false;
  await prisma.clubVoucher.update({
    where: { id: voucherId },
    data: { status: "entregue", entregueAt: new Date() },
  });
  return true;
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
