import { DateTime } from "luxon";

/**
 * Núcleo ÚNICO de períodos do portal (F1 do seletor global). Funções PURAS
 * (`now` injetável — testável), sempre resolvendo fronteiras de dia em
 * America/Sao_Paulo (nunca UTC puro: o clássico registro de 21h não pode cair
 * no dia seguinte). Nenhuma tela recalcula data por conta própria — proibido.
 *
 * O intervalo sai em TRÊS formas (as duas convenções do banco + URL):
 *  - `from`/`to`      → instantes (colunas timestamptz: bookings, ledger…)
 *  - `dateFrom`/`dateTo` → UTC-meia-noite (colunas DATE: competência financeira)
 *  - `deISO`/`ateISO` → date-only p/ URL/exibição (?de=2026-06-01&ate=2026-06-30)
 */

export const TZ_PADRAO = "America/Sao_Paulo";

/** Máximo do intervalo personalizado (dias) — configurável por chamada. */
export const PERIODO_MAX_DIAS = 366;

export const PERIOD_PRESETS = [
  "hoje",
  "ultimos7",
  "ultimos30",
  "mesAnterior",
  "personalizado",
] as const;

export type PeriodPreset = (typeof PERIOD_PRESETS)[number];

export const PRESET_LABEL: Record<PeriodPreset, string> = {
  hoje: "Hoje",
  ultimos7: "Últimos 7 dias",
  ultimos30: "Últimos 30 dias",
  mesAnterior: "Mês anterior",
  personalizado: "Personalizado",
};

export interface Period {
  preset: PeriodPreset;
  /** date-only ISO — fonte da URL e da exibição. */
  deISO: string;
  ateISO: string;
  /** Instantes: início 00:00:00.000 e fim 23:59:59.999 no fuso do negócio. */
  from: Date;
  to: Date;
  /** Fronteiras p/ colunas DATE (UTC-meia-noite, inclusivas gte/lte). */
  dateFrom: Date;
  dateTo: Date;
  /** Quantos dias o intervalo cobre (inclusivo). */
  dias: number;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Resolve um preset (exceto personalizado) → [de, ate] date-only no fuso. */
export function resolvePreset(
  preset: Exclude<PeriodPreset, "personalizado">,
  now: DateTime,
): { deISO: string; ateISO: string } {
  const hoje = now.startOf("day");
  switch (preset) {
    case "hoje":
      return { deISO: iso(hoje), ateISO: iso(hoje) };
    case "ultimos7":
      return { deISO: iso(hoje.minus({ days: 6 })), ateISO: iso(hoje) };
    case "ultimos30":
      return { deISO: iso(hoje.minus({ days: 29 })), ateISO: iso(hoje) };
    case "mesAnterior": {
      const m = hoje.minus({ months: 1 });
      return { deISO: iso(m.startOf("month")), ateISO: iso(m.endOf("month")) };
    }
  }
}

function iso(d: DateTime): string {
  return d.toISODate() ?? "";
}

/** Monta o Period completo a partir das datas ISO (já validadas). */
export function buildPeriod(
  preset: PeriodPreset,
  deISO: string,
  ateISO: string,
  zone: string = TZ_PADRAO,
): Period {
  const de = DateTime.fromISO(deISO, { zone });
  const ate = DateTime.fromISO(ateISO, { zone });
  return {
    preset,
    deISO,
    ateISO,
    from: de.startOf("day").toJSDate(),
    to: ate.endOf("day").toJSDate(), // 23:59:59.999 no fuso
    dateFrom: DateTime.fromISO(deISO, { zone: "utc" }).toJSDate(),
    dateTo: DateTime.fromISO(ateISO, { zone: "utc" }).toJSDate(),
    dias: Math.round(ate.startOf("day").diff(de.startOf("day"), "days").days) + 1,
  };
}

export interface ParsePeriodoOpts {
  /** Preset default do módulo quando a URL não traz nada (preserva comportamento atual). */
  fallback?: Exclude<PeriodPreset, "personalizado">;
  maxDias?: number;
  /** Injetável p/ teste; default = agora no fuso. */
  now?: DateTime;
  zone?: string;
}

export interface ParsePeriodoResult {
  period: Period;
  /** Mensagem gentil quando o personalizado veio inválido (caiu no fallback). */
  error?: string;
}

/**
 * Contrato ÚNICO de leitura de período (searchParams das páginas e APIs):
 * `?periodo=<preset>` OU `?de=YYYY-MM-DD&ate=YYYY-MM-DD` (personalizado).
 * Inválido → fallback do módulo + mensagem no tom da marca (nunca lança).
 */
export function parsePeriodo(
  params: { periodo?: string; de?: string; ate?: string },
  opts: ParsePeriodoOpts = {},
): ParsePeriodoResult {
  const zone = opts.zone ?? TZ_PADRAO;
  const now = opts.now ?? DateTime.now().setZone(zone);
  const fallback = opts.fallback ?? "hoje";
  const maxDias = opts.maxDias ?? PERIODO_MAX_DIAS;

  const usarFallback = (error?: string): ParsePeriodoResult => {
    const r = resolvePreset(fallback, now);
    return { period: buildPeriod(fallback, r.deISO, r.ateISO, zone), error };
  };

  // Personalizado por de/ate explícitos.
  if (params.de || params.ate) {
    const de = params.de ?? "";
    const ate = params.ate ?? "";
    if (!DATE_RE.test(de) || !DATE_RE.test(ate)) {
      return usarFallback("Não entendi essas datas — voltei pro período padrão.");
    }
    const dDe = DateTime.fromISO(de, { zone });
    const dAte = DateTime.fromISO(ate, { zone });
    if (!dDe.isValid || !dAte.isValid) {
      return usarFallback("Não entendi essas datas — voltei pro período padrão.");
    }
    if (dDe > dAte) {
      return usarFallback("A data inicial precisa vir antes da final.");
    }
    const dias = Math.round(dAte.diff(dDe, "days").days) + 1;
    if (dias > maxDias) {
      return usarFallback(
        `Esse intervalo é longo demais — o máximo é ${maxDias} dias.`,
      );
    }
    return { period: buildPeriod("personalizado", de, ate, zone) };
  }

  const preset = params.periodo as PeriodPreset | undefined;
  if (preset && preset !== "personalizado" && PERIOD_PRESETS.includes(preset)) {
    const r = resolvePreset(preset, now);
    return { period: buildPeriod(preset, r.deISO, r.ateISO, zone) };
  }
  return usarFallback();
}

/** Query string canônica de um período (preserva a URL compartilhável). */
export function periodoQuery(p: Period): string {
  return p.preset === "personalizado"
    ? `de=${p.deISO}&ate=${p.ateISO}`
    : `periodo=${p.preset}`;
}

/** "1 de junho — 30 de junho de 2026" (pt-BR; ano só quando muda/é passado). */
export function formatPeriodoExtenso(p: Period, zone: string = TZ_PADRAO): string {
  const de = DateTime.fromISO(p.deISO, { zone }).setLocale("pt-BR");
  const ate = DateTime.fromISO(p.ateISO, { zone }).setLocale("pt-BR");
  if (p.deISO === p.ateISO) return ate.toFormat("d 'de' MMMM 'de' yyyy");
  const mesmoAno = de.year === ate.year;
  const fmtDe = mesmoAno ? "d 'de' MMMM" : "d 'de' MMMM 'de' yyyy";
  return `${de.toFormat(fmtDe)} — ${ate.toFormat("d 'de' MMMM 'de' yyyy")}`;
}
