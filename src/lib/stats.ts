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

/** Resumo do período (default: mês atual). Cacheado por 5min por período. */
export async function getResumo(mes?: string): Promise<{ resumo: Resumo; label: string; mesAtual: string }> {
  const settings = await getSettings();
  const zone = settings.timezone;
  const now = DateTime.now().setZone(zone);
  const { start, end, label } = monthRange(mes, now);
  const key = start.toFormat("yyyy-MM");

  const cached = cache.get(key);
  if (cached && Date.now() - cached.at < TTL_MS) {
    return { resumo: cached.data, label, mesAtual: now.toFormat("yyyy-MM") };
  }

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

  const bookings: ResumoBooking[] = rows.map((r) => ({
    status: r.status,
    priceCents: r.priceCents,
    source: r.source,
    startsAt: r.startsAt,
    endsAt: r.endsAt,
    serviceName: r.service.name,
  }));

  // Ocupação só conta dias já decorridos (não inflar com o futuro do mês).
  const occEnd = DateTime.min(end, now.plus({ days: 1 }).startOf("day"));
  const availableMin = availableMinutesInRange(
    settings.workingHours,
    start.toMillis(),
    occEnd.toMillis(),
    zone,
  );

  const data = computeResumo(bookings, availableMin);
  cache.set(key, { at: Date.now(), data });
  return { resumo: data, label, mesAtual: now.toFormat("yyyy-MM") };
}
