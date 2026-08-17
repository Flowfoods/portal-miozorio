import { DateTime } from "luxon";
import { prisma } from "./prisma";
import { getSettings, type WeeklyHours } from "./settings";

/**
 * Painel de números do estúdio (M14 — aba "Resumo"). Tudo derivado de
 * bookings + business_settings; sem tabela nova. A agregação é uma função
 * PURA (computeResumo) — a leitura do banco e o cache de 5min ficam fora.
 */

// Luxon weekday 1..7 (seg..dom) → chave do working_hours.
const WD = ["", "mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;

export interface ResumoBooking {
  status: string;
  priceCents: number;
  source: string;
  startsAt: Date;
  endsAt: Date;
  serviceName: string;
}

export interface ServicoLinha {
  nome: string;
  atendimentos: number;
  faturamentoCents: number;
}

export interface OrigemLinha {
  atendimentos: number;
  faturamentoCents: number;
}

export interface Resumo {
  faturamentoCents: number;
  atendimentos: number;
  ticketMedioCents: number;
  noShow: number;
  noShowRate: number; // 0..1
  canceladas: number;
  ocupacao: number; // 0..1 (minutos agendados / disponíveis até hoje)
  topServicos: ServicoLinha[];
  origem: { site: OrigemLinha; telefone: OrigemLinha };
}

/** "09:00","19:00" → 600 (minutos). Tolera formato inválido devolvendo 0. */
export function windowMinutes(inicio: string, fim: string): number {
  const a = /^(\d{2}):(\d{2})$/.exec(inicio);
  const b = /^(\d{2}):(\d{2})$/.exec(fim);
  if (!a || !b) return 0;
  const min = (h: string, m: string) => Number(h) * 60 + Number(m);
  return Math.max(0, min(b[1]!, b[2]!) - min(a[1]!, a[2]!));
}

/** Minutos de atendimento disponíveis (working_hours) entre [start, end). */
export function availableMinutesInRange(
  wh: WeeklyHours,
  startMs: number,
  endMs: number,
  zone: string,
): number {
  if (endMs <= startMs) return 0;
  let total = 0;
  let day = DateTime.fromMillis(startMs, { zone }).startOf("day");
  const end = DateTime.fromMillis(endMs, { zone });
  // Guarda de segurança: no máximo ~1 ano de dias.
  for (let i = 0; i < 400 && day < end; i++) {
    for (const [a, b] of wh[WD[day.weekday]!] ?? []) {
      total += windowMinutes(a, b);
    }
    day = day.plus({ days: 1 });
  }
  return total;
}

/** Site = agendamento online (web); telefone = encaixe manual (whatsapp/manual). */
export function bucketSource(source: string): "site" | "telefone" {
  return source === "web" ? "site" : "telefone";
}

/**
 * Função pura: agrega os bookings do período. `availableMin` já vem calculado
 * (minutos de agenda disponíveis até hoje) para não acoplar tempo aqui.
 */
export function computeResumo(
  bookings: ResumoBooking[],
  availableMin: number,
): Resumo {
  let faturamentoCents = 0;
  let atendimentos = 0;
  let noShow = 0;
  let canceladas = 0;
  let bookedMin = 0;

  const servicos = new Map<string, ServicoLinha>();
  const origem = {
    site: { atendimentos: 0, faturamentoCents: 0 },
    telefone: { atendimentos: 0, faturamentoCents: 0 },
  };

  for (const b of bookings) {
    // Ocupação: tempo de cadeira reservado (confirmado/concluído; endsAt já
    // inclui o buffer).
    if (b.status === "confirmed" || b.status === "completed") {
      bookedMin += (b.endsAt.getTime() - b.startsAt.getTime()) / 60000;
    }
    if (b.status === "no_show") noShow++;
    if (b.status === "cancelled_by_client" || b.status === "cancelled_by_business") {
      canceladas++;
    }
    if (b.status !== "completed") continue;

    // Daqui pra baixo: só atendimentos realizados (faturamento real).
    atendimentos++;
    faturamentoCents += b.priceCents;

    const linha = servicos.get(b.serviceName) ?? {
      nome: b.serviceName,
      atendimentos: 0,
      faturamentoCents: 0,
    };
    linha.atendimentos++;
    linha.faturamentoCents += b.priceCents;
    servicos.set(b.serviceName, linha);

    const bucket = origem[bucketSource(b.source)];
    bucket.atendimentos++;
    bucket.faturamentoCents += b.priceCents;
  }

  const topServicos = Array.from(servicos.values())
    .sort((a, b) => b.faturamentoCents - a.faturamentoCents)
    .slice(0, 5);

  return {
    faturamentoCents,
    atendimentos,
    ticketMedioCents: atendimentos ? Math.round(faturamentoCents / atendimentos) : 0,
    noShow,
    noShowRate: noShow + atendimentos ? noShow / (noShow + atendimentos) : 0,
    canceladas,
    ocupacao: availableMin ? Math.min(1, bookedMin / availableMin) : 0,
    topServicos,
    origem,
  };
}

/** Faixa [início, fim) de um mês "YYYY-MM" (ou o mês de `now`) no fuso. */
export function monthRange(
  mes: string | undefined,
  now: DateTime,
): { start: DateTime; end: DateTime; label: string } {
  const base =
    mes && /^\d{4}-\d{2}$/.test(mes)
      ? DateTime.fromISO(`${mes}-01`, { zone: now.zone }).startOf("month")
      : now.startOf("month");
  const start = base.isValid ? base : now.startOf("month");
  return {
    start,
    end: start.plus({ months: 1 }),
    label: start.setLocale("pt-BR").toFormat("LLLL 'de' yyyy"),
  };
}

// ── Leitura + cache (5min, R do M14) ─────────────────────────────────────────

const TTL_MS = 5 * 60_000;
const cache = new Map<string, { at: number; data: Resumo }>();

/**
 * Resumo de um INTERVALO arbitrário [start, end) — F3 do período global.
 * Cache de 5min por intervalo (mesma política do mensal).
 */
export async function getResumoRange(
  start: DateTime,
  end: DateTime,
): Promise<Resumo> {
  const settings = await getSettings();
  const zone = settings.timezone;
  const now = DateTime.now().setZone(zone);
  const key = `${start.toISODate()}..${end.toISODate()}`;

  const cached = cache.get(key);
  if (cached && Date.now() - cached.at < TTL_MS) return cached.data;

  const rows = await prisma.booking.findMany({
    where: { startsAt: { gte: start.toJSDate(), lt: end.toJSDate() } },
    select: {
      status: true,
      priceCents: true,
      source: true,
      startsAt: true,
      endsAt: true,
      service: { select: { name: true } },
    },
  });

  // Ocupação só conta dias já decorridos (não inflar com o futuro do período).
  const occEnd = DateTime.min(end, now.plus({ days: 1 }).startOf("day"));
  const occEndMs = occEnd.toMillis();

  // Reservas confirmadas no FUTURO ficam fora da conta: elas só alimentariam o
  // numerador da ocupação (confirmed não entra em faturamento/faltas), e o
  // denominador já é cortado em occEnd — numerador e denominador precisam
  // cobrir a mesma janela, como o comentário acima sempre prometeu.
  // (Revisão adversarial 17/08: gauge chegava a 100% com metade em reservas
  // futuras e aconselhava "abrir mais horários".)
  const bookings: ResumoBooking[] = rows
    .filter(
      (r) => !(r.status === "confirmed" && r.startsAt.getTime() >= occEndMs),
    )
    .map((r) => ({
      status: r.status,
      priceCents: r.priceCents,
      source: r.source,
      startsAt: r.startsAt,
      endsAt: r.endsAt,
      serviceName: r.service.name,
    }));
  const availableMin = availableMinutesInRange(
    settings.workingHours,
    start.toMillis(),
    occEnd.toMillis(),
    zone,
  );

  const data = computeResumo(bookings, availableMin);
  cache.set(key, { at: Date.now(), data });
  return data;
}

/** Resumo do mês (retrocompat do M14; default: mês atual). */
export async function getResumo(
  mes?: string,
): Promise<{ resumo: Resumo; label: string; mesAtual: string }> {
  const settings = await getSettings();
  const now = DateTime.now().setZone(settings.timezone);
  const { start, end, label } = monthRange(mes, now);
  const resumo = await getResumoRange(start, end);
  return { resumo, label, mesAtual: now.toFormat("yyyy-MM") };
}

// ── Extras do Resumo redesenhado (V3) — leituras puras, nada de regra nova ──

export interface ResumoExtras {
  /** Faturamento por dia (só completed), para o gráfico de área. */
  serieDiaria: { label: string; valor: number }[];
  /** Atendimentos completed por dia da semana (Seg..Dom). */
  porDiaSemana: { label: string; valor: number }[];
  /** Clientes criadas no período e no período anterior equivalente. */
  novasClientes: number;
  novasClientesAnterior: number;
  /** Das clientes atendidas no período, quantas já eram da casa (retorno). */
  retorno: { recorrentes: number; total: number };
  /** Próximos agendamentos confirmados (a partir de agora). */
  proximos: {
    id: string;
    cliente: string;
    servico: string;
    startsAt: Date;
    location: string;
  }[];
}

const extrasCache = new Map<string, { at: number; data: ResumoExtras }>();

const DIAS_SEMANA = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

export async function getResumoExtras(
  start: DateTime,
  end: DateTime,
  /** Janela de comparação — a MESMA usada nos outros KPIs da página, para o
   *  delta de "Novas clientes" não sair de uma base diferente (revisão 17/08:
   *  a janela deslizante em ms divergia do mês-calendário e invertia sinal). */
  antStart: DateTime,
  antEnd: DateTime,
): Promise<ResumoExtras> {
  const settings = await getSettings();
  const zone = settings.timezone;
  const key = `extras:${start.toISODate()}..${end.toISODate()}|${antStart.toISODate()}..${antEnd.toISODate()}`;
  const cached = extrasCache.get(key);
  if (cached && Date.now() - cached.at < TTL_MS) return cached.data;

  const [completed, novas, novasAnt, clientesPeriodo, proximosRows] =
    await Promise.all([
      prisma.booking.findMany({
        where: {
          status: "completed",
          startsAt: { gte: start.toJSDate(), lt: end.toJSDate() },
        },
        select: { startsAt: true, priceCents: true, customerId: true },
      }),
      prisma.customer.count({
        where: { createdAt: { gte: start.toJSDate(), lt: end.toJSDate() } },
      }),
      prisma.customer.count({
        where: { createdAt: { gte: antStart.toJSDate(), lt: antEnd.toJSDate() } },
      }),
      prisma.booking.findMany({
        where: {
          status: "completed",
          startsAt: { gte: start.toJSDate(), lt: end.toJSDate() },
        },
        select: { customerId: true },
        distinct: ["customerId"],
      }),
      prisma.booking.findMany({
        where: { status: "confirmed", startsAt: { gte: new Date() } },
        orderBy: { startsAt: "asc" },
        take: 6,
        select: {
          id: true,
          startsAt: true,
          location: true,
          customer: { select: { name: true } },
          service: { select: { name: true } },
        },
      }),
    ]);

  // Série de faturamento (dias sem atendimento entram com 0). Períodos longos
  // agregam por SEMANA em vez de truncar — a versão anterior cortava em 120
  // dias em silêncio e o gráfico "perdia" o resto do período (revisão 17/08).
  const porDia = new Map<string, number>();
  for (const b of completed) {
    const d = DateTime.fromJSDate(b.startsAt, { zone }).toISODate()!;
    porDia.set(d, (porDia.get(d) ?? 0) + b.priceCents);
  }
  const serieDiaria: { label: string; valor: number }[] = [];
  const dias = Math.min(400, Math.ceil(end.diff(start, "days").days));
  const passoDias = dias > 124 ? 7 : 1;
  const hoje = DateTime.now().setZone(zone);
  for (let i = 0; i < dias; i += passoDias) {
    const d = start.plus({ days: i });
    if (d > hoje) break; // futuro não entra na série
    let valor = 0;
    for (let j = 0; j < passoDias && i + j < dias; j++) {
      valor += porDia.get(start.plus({ days: i + j }).toISODate()!) ?? 0;
    }
    serieDiaria.push({ label: d.toFormat("d/M"), valor });
  }

  const porDiaSemana = DIAS_SEMANA.map((label) => ({ label, valor: 0 }));
  for (const b of completed) {
    const wd = DateTime.fromJSDate(b.startsAt, { zone }).weekday; // 1..7
    porDiaSemana[wd - 1]!.valor++;
  }

  // Retorno: clientes atendidas no período que já tinham completed ANTES dele.
  const ids = clientesPeriodo.map((c) => c.customerId);
  const recorrentes = ids.length
    ? (
        await prisma.booking.findMany({
          where: {
            status: "completed",
            customerId: { in: ids },
            startsAt: { lt: start.toJSDate() },
          },
          select: { customerId: true },
          distinct: ["customerId"],
        })
      ).length
    : 0;

  const data: ResumoExtras = {
    serieDiaria,
    porDiaSemana,
    novasClientes: novas,
    novasClientesAnterior: novasAnt,
    retorno: { recorrentes, total: ids.length },
    proximos: proximosRows.map((p) => ({
      id: p.id,
      cliente: p.customer.name,
      servico: p.service.name,
      startsAt: p.startsAt,
      location: p.location,
    })),
  };
  extrasCache.set(key, { at: Date.now(), data });
  return data;
}
