import { DateTime } from "luxon";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";
import {
  montarDRE,
  kpisDoMes,
  alertasDoMes,
  type MovimentoMensal,
  type DRE,
  type KPIs,
} from "./dre";

/**
 * Camada de CONSULTA do Financeiro (toca o banco). Resolve regime (caixa vs
 * competência) e as fronteiras de mês em America/Sao_Paulo, e delega o cálculo
 * ao núcleo puro (dre.ts). Datas: competência é DATE (compara em UTC-meia-noite);
 * caixa é TIMESTAMPTZ (compara no instante SP→UTC).
 */

export type Regime = "caixa" | "competencia";

/** service.category → code da categoria de receita (seed). */
export function categoryCodeForServiceCategory(category: string): string {
  switch (category) {
    case "social":
      return "rev-social";
    case "cabelo":
      return "rev-cabelo";
    case "sobrancelha":
      return "rev-sobrancelha";
    case "curso":
      return "rev-curso";
    case "noiva":
      return "rev-noiva";
    case "debutante":
      return "rev-debutante";
    default:
      return "rev-avulsa";
  }
}

/** Mês de competência: fronteiras em UTC-meia-noite (coluna DATE). */
function competenceRange(ano: number, mes: number) {
  const start = DateTime.fromObject(
    { year: ano, month: mes, day: 1 },
    { zone: "utc" },
  ).startOf("month");
  return { gte: start.toJSDate(), lt: start.plus({ months: 1 }).toJSDate() };
}

/** Mês no fuso do negócio: fronteiras como instantes UTC (colunas TIMESTAMPTZ). */
function instantRange(ano: number, mes: number, tz: string) {
  const start = DateTime.fromObject(
    { year: ano, month: mes, day: 1 },
    { zone: tz },
  ).startOf("month");
  return { gte: start.toJSDate(), lt: start.plus({ months: 1 }).toJSDate() };
}

/**
 * Monta o movimento de um mês conforme o regime. Só lançamentos ativos
 * (soft-delete respeitado). atendimentos/no-show vêm dos bookings concluídos
 * pela data do evento (startsAt), independente do regime.
 */
export async function fetchMovimento(
  ano: number,
  mes: number,
  regime: Regime,
): Promise<MovimentoMensal> {
  const { timezone: tz } = await getSettings();
  const comp = competenceRange(ano, mes);
  const inst = instantRange(ano, mes, tz);

  const receitaWhere =
    regime === "competencia"
      ? { active: true, competenceDate: comp }
      : { active: true, receivedAt: inst };
  const despesaWhere =
    regime === "competencia"
      ? { active: true, competenceDate: comp }
      : { active: true, paidAt: inst };

  const [receitas, despesas, atendimentos, noShow] = await Promise.all([
    prisma.revenueEntry.findMany({
      where: receitaWhere,
      select: {
        amountCents: true,
        cardFeeCents: true,
        category: { select: { code: true } },
      },
    }),
    prisma.expense.findMany({
      where: despesaWhere,
      select: {
        amountCents: true,
        category: { select: { dreGroup: true, nature: true, isCmv: true } },
      },
    }),
    prisma.booking.count({
      where: { status: "completed", startsAt: inst },
    }),
    prisma.booking.aggregate({
      where: { status: "no_show", startsAt: inst },
      _count: true,
      _sum: { priceCents: true },
    }),
  ]);

  return {
    receitas: receitas.map((r) => ({
      amountCents: r.amountCents,
      cardFeeCents: r.cardFeeCents ?? 0,
      categoryCode: r.category?.code ?? null,
    })),
    despesas: despesas.map((d) => ({
      amountCents: d.amountCents,
      dreGroup: d.category.dreGroup,
      nature: d.category.nature,
      isCmv: d.category.isCmv,
    })),
    atendimentos,
    noShowCount: noShow._count,
    noShowValorCents: noShow._sum.priceCents ?? 0,
  };
}

export interface ResumoMes {
  ano: number;
  mes: number;
  dre: DRE;
  kpis: KPIs;
  alertas: string[];
}

/** DRE + KPIs + alertas de um mês (orquestra consulta + núcleo puro). */
export async function resumoDoMes(
  ano: number,
  mes: number,
  regime: Regime,
): Promise<ResumoMes> {
  const mov = await fetchMovimento(ano, mes, regime);
  const dre = montarDRE(mov);
  const kpis = kpisDoMes(mov, dre);
  return { ano, mes, dre, kpis, alertas: alertasDoMes(dre, kpis) };
}

export interface PontoSerie {
  ano: number;
  mes: number;
  label: string; // "jun/26"
  receitaCents: number;
  despesaCents: number; // inclui taxa de cartão (consistente com o resultado)
  resultadoCents: number;
}

/**
 * Série mensal para o gráfico comparativo. de/ate em "YYYY-MM" (inclusive).
 * resultado = receita − despesa; bate com o lucro líquido do DRE.
 */
export async function serieMensal(
  de: string,
  ate: string,
  regime: Regime,
): Promise<PontoSerie[]> {
  const [aDe, mDe] = de.split("-").map(Number);
  const [aAte, mAte] = ate.split("-").map(Number);
  let cursor = DateTime.fromObject({ year: aDe, month: mDe, day: 1 });
  const fim = DateTime.fromObject({ year: aAte, month: mAte, day: 1 });
  const meses: { ano: number; mes: number }[] = [];
  // Teto de segurança: no máximo 36 meses na série.
  for (let i = 0; cursor <= fim && i < 36; i++) {
    meses.push({ ano: cursor.year, mes: cursor.month });
    cursor = cursor.plus({ months: 1 });
  }

  const pontos = await Promise.all(
    meses.map(async ({ ano, mes }) => {
      const mov = await fetchMovimento(ano, mes, regime);
      const receitaCents = mov.receitas.reduce((a, r) => a + r.amountCents, 0);
      const cardFees = mov.receitas.reduce((a, r) => a + r.cardFeeCents, 0);
      const despesaCents =
        mov.despesas.reduce((a, d) => a + d.amountCents, 0) + cardFees;
      return {
        ano,
        mes,
        label: DateTime.fromObject({ year: ano, month: mes })
          .setLocale("pt-BR")
          .toFormat("LLL/yy"),
        receitaCents,
        despesaCents,
        resultadoCents: receitaCents - despesaCents,
      };
    }),
  );
  return pontos;
}

/**
 * Reconhece a receita de um booking concluído (idempotente por bookingId).
 * Cria o lançamento se ainda não existe; se existe, atualiza só os dados
 * FACTUAIS do booking (valor/competência/cliente) — preserva edições da Mi
 * em caixa/categoria/taxa. Valor = soma dos itens (priceCobradoCents) ou,
 * sem itens, o priceCents do booking.
 */
export async function reconhecerReceitaDeBooking(
  bookingId: string,
): Promise<{ ok: boolean; created: boolean }> {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      service: { select: { category: true } },
      customer: { select: { name: true } },
      items: { select: { priceCobradoCents: true } },
    },
  });
  if (!booking || booking.status !== "completed") {
    return { ok: false, created: false };
  }

  const amountCents = booking.items.length
    ? booking.items.reduce((a, it) => a + it.priceCobradoCents, 0)
    : booking.priceCents;

  const tz = (await getSettings()).timezone;
  // Competência = dia do evento (DATE em UTC-meia-noite, no fuso do negócio).
  const eventoSP = DateTime.fromJSDate(booking.startsAt).setZone(tz);
  const competenceDate = DateTime.fromObject(
    { year: eventoSP.year, month: eventoSP.month, day: eventoSP.day },
    { zone: "utc" },
  ).toJSDate();

  const code = categoryCodeForServiceCategory(booking.service.category);
  const categoria = await prisma.financialCategory.findUnique({
    where: { code },
    select: { id: true },
  });

  const existente = await prisma.revenueEntry.findUnique({
    where: { bookingId },
    select: { id: true },
  });

  if (existente) {
    await prisma.revenueEntry.update({
      where: { id: existente.id },
      data: {
        amountCents,
        competenceDate,
        customerName: booking.customer.name,
        description: `Atendimento — ${booking.customer.name}`,
      },
    });
    return { ok: true, created: false };
  }

  await prisma.revenueEntry.create({
    data: {
      categoryId: categoria?.id ?? null,
      description: `Atendimento — ${booking.customer.name}`,
      amountCents,
      competenceDate,
      receivedAt: booking.startsAt, // padrão: pago no dia (editável)
      source: "booking",
      bookingId,
      customerName: booking.customer.name,
    },
  });
  return { ok: true, created: true };
}

/**
 * Backfill: reconhece a receita de todos os bookings concluídos que ainda não
 * têm lançamento. Usado uma vez após o deploy (e seguro de repetir).
 */
export async function backfillReceitaBookings(): Promise<{
  total: number;
  criados: number;
}> {
  const pendentes = await prisma.booking.findMany({
    where: { status: "completed", revenueEntry: { is: null } },
    select: { id: true },
  });
  let criados = 0;
  for (const b of pendentes) {
    const r = await reconhecerReceitaDeBooking(b.id).catch(() => null);
    if (r?.created) criados++;
  }
  return { total: pendentes.length, criados };
}
