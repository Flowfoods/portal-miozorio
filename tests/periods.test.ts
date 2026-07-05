import { describe, it, expect } from "vitest";
import { DateTime } from "luxon";
import {
  resolvePreset,
  buildPeriod,
  parsePeriodo,
  periodoQuery,
  periodoAnterior,
  formatPeriodoExtenso,
  TZ_PADRAO,
} from "@/lib/periods";

const spNow = (isoLocal: string) =>
  DateTime.fromISO(isoLocal, { zone: TZ_PADRAO });

describe("resolvePreset — presets no fuso de São Paulo", () => {
  const now = spNow("2026-07-05T10:00:00"); // domingo

  it("hoje = dia atual (de = ate)", () => {
    expect(resolvePreset("hoje", now)).toEqual({
      deISO: "2026-07-05",
      ateISO: "2026-07-05",
    });
  });

  it("ultimos7 = hoje − 6 → hoje (7 dias inclusivos, cruza virada de mês)", () => {
    expect(resolvePreset("ultimos7", now)).toEqual({
      deISO: "2026-06-29",
      ateISO: "2026-07-05",
    });
  });

  it("ultimos30 = hoje − 29 → hoje", () => {
    expect(resolvePreset("ultimos30", now)).toEqual({
      deISO: "2026-06-06",
      ateISO: "2026-07-05",
    });
  });

  it("mesAnterior = 1º ao último dia do mês passado (30 dias)", () => {
    expect(resolvePreset("mesAnterior", now)).toEqual({
      deISO: "2026-06-01",
      ateISO: "2026-06-30",
    });
  });

  it("mesAnterior com 31 dias (agosto → julho)", () => {
    expect(resolvePreset("mesAnterior", spNow("2026-08-15T12:00:00"))).toEqual({
      deISO: "2026-07-01",
      ateISO: "2026-07-31",
    });
  });

  it("mesAnterior com fevereiro comum (28) e bissexto (29)", () => {
    expect(resolvePreset("mesAnterior", spNow("2026-03-10T12:00:00"))).toEqual({
      deISO: "2026-02-01",
      ateISO: "2026-02-28",
    });
    expect(resolvePreset("mesAnterior", spNow("2024-03-10T12:00:00"))).toEqual({
      deISO: "2024-02-01",
      ateISO: "2024-02-29", // bissexto
    });
  });

  it("mesAnterior na virada de ano (janeiro → dezembro do ano anterior)", () => {
    expect(resolvePreset("mesAnterior", spNow("2026-01-10T12:00:00"))).toEqual({
      deISO: "2025-12-01",
      ateISO: "2025-12-31",
    });
  });

  it("fronteira de timezone: 23h30 em SP ainda é o MESMO dia (não o de UTC)", () => {
    // 2026-07-31T23:30 em SP = 2026-08-01T02:30Z — 'hoje' tem que ser 31/07.
    const tarde = spNow("2026-07-31T23:30:00");
    expect(resolvePreset("hoje", tarde)).toEqual({
      deISO: "2026-07-31",
      ateISO: "2026-07-31",
    });
    // e mesAnterior a partir dela é junho, não julho.
    expect(resolvePreset("mesAnterior", tarde).deISO).toBe("2026-06-01");
  });
});

describe("buildPeriod — as três formas do intervalo", () => {
  const p = buildPeriod("personalizado", "2026-06-01", "2026-06-30");

  it("instantes: 00:00 SP e 23:59:59.999 SP (SP = UTC−3)", () => {
    expect(p.from.toISOString()).toBe("2026-06-01T03:00:00.000Z");
    expect(p.to.toISOString()).toBe("2026-07-01T02:59:59.999Z");
  });

  it("fronteiras DATE: UTC-meia-noite inclusivas", () => {
    expect(p.dateFrom.toISOString()).toBe("2026-06-01T00:00:00.000Z");
    expect(p.dateTo.toISOString()).toBe("2026-06-30T00:00:00.000Z");
  });

  it("dias inclusivos", () => {
    expect(p.dias).toBe(30);
    expect(buildPeriod("hoje", "2026-07-05", "2026-07-05").dias).toBe(1);
  });
});

describe("parsePeriodo — contrato único (URL → Period)", () => {
  const now = spNow("2026-07-05T10:00:00");

  it("sem parâmetros → fallback do módulo", () => {
    const r = parsePeriodo({}, { fallback: "ultimos7", now });
    expect(r.period.preset).toBe("ultimos7");
    expect(r.error).toBeUndefined();
  });

  it("?periodo=mesAnterior resolve o preset", () => {
    const r = parsePeriodo({ periodo: "mesAnterior" }, { now });
    expect(r.period.deISO).toBe("2026-06-01");
    expect(r.period.ateISO).toBe("2026-06-30");
  });

  it("?de&ate válidos viram personalizado", () => {
    const r = parsePeriodo({ de: "2026-06-10", ate: "2026-06-20" }, { now });
    expect(r.period.preset).toBe("personalizado");
    expect(r.period.dias).toBe(11);
  });

  it("de > ate → erro gentil + fallback (nunca lança)", () => {
    const r = parsePeriodo(
      { de: "2026-06-20", ate: "2026-06-10" },
      { fallback: "hoje", now },
    );
    expect(r.error).toMatch(/inicial/);
    expect(r.period.preset).toBe("hoje");
  });

  it("intervalo acima do máximo → erro + fallback", () => {
    const r = parsePeriodo(
      { de: "2025-01-01", ate: "2026-07-01" },
      { fallback: "ultimos30", now },
    );
    expect(r.error).toMatch(/longo demais/);
    expect(r.period.preset).toBe("ultimos30");
  });

  it("formato inválido → erro + fallback", () => {
    const r = parsePeriodo({ de: "01/06/2026", ate: "2026-06-30" }, { now });
    expect(r.error).toBeDefined();
    expect(r.period.preset).toBe("hoje");
  });

  it("preset desconhecido → fallback silencioso", () => {
    const r = parsePeriodo({ periodo: "semestre" }, { fallback: "hoje", now });
    expect(r.period.preset).toBe("hoje");
    expect(r.error).toBeUndefined();
  });
});

describe("periodoAnterior — janela anterior equivalente", () => {
  it("últimos 7 → os 7 dias imediatamente anteriores", () => {
    const p = buildPeriod("ultimos7", "2026-06-29", "2026-07-05");
    const ant = periodoAnterior(p);
    expect(ant.deISO).toBe("2026-06-22");
    expect(ant.ateISO).toBe("2026-06-28");
    expect(ant.dias).toBe(7);
  });

  it("mês cheio na virada de mês/ano", () => {
    const jan = buildPeriod("personalizado", "2026-01-01", "2026-01-31");
    const ant = periodoAnterior(jan);
    expect(ant.deISO).toBe("2025-12-01"); // 31 dias antes de 01/01
    expect(ant.ateISO).toBe("2025-12-31");
  });

  it("um dia → o dia anterior", () => {
    const dia = buildPeriod("hoje", "2026-03-01", "2026-03-01");
    const ant = periodoAnterior(dia);
    expect(ant.deISO).toBe("2026-02-28"); // fevereiro comum
    expect(ant.ateISO).toBe("2026-02-28");
  });
});

describe("periodoQuery + formatPeriodoExtenso", () => {
  const now = spNow("2026-07-05T10:00:00");

  it("query canônica: preset vs personalizado", () => {
    const preset = parsePeriodo({ periodo: "ultimos7" }, { now }).period;
    expect(periodoQuery(preset)).toBe("periodo=ultimos7");
    const custom = parsePeriodo({ de: "2026-06-01", ate: "2026-06-30" }, { now })
      .period;
    expect(periodoQuery(custom)).toBe("de=2026-06-01&ate=2026-06-30");
  });

  it("por extenso em pt-BR", () => {
    const p = buildPeriod("personalizado", "2026-06-01", "2026-06-30");
    expect(formatPeriodoExtenso(p)).toBe("1 de junho — 30 de junho de 2026");
    const dia = buildPeriod("hoje", "2026-07-05", "2026-07-05");
    expect(formatPeriodoExtenso(dia)).toBe("5 de julho de 2026");
    const viraAno = buildPeriod("personalizado", "2025-12-15", "2026-01-15");
    expect(formatPeriodoExtenso(viraAno)).toBe(
      "15 de dezembro de 2025 — 15 de janeiro de 2026",
    );
  });
});
