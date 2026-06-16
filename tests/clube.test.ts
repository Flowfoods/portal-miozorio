import { describe, it, expect } from "vitest";
import { DateTime } from "luxon";
import {
  segmentoDe,
  gerarCodigoIndicacao,
  degrausAtingidos,
} from "@/lib/clube";

const now = DateTime.fromISO("2026-06-12T12:00:00", {
  zone: "America/Sao_Paulo",
});
const mesesAtras = (n: number) => now.minus({ months: n }).toJSDate();

describe("segmentoDe (segmentação por ocasião)", () => {
  it("NOVA: primeira ocasião recente, sem indicações", () => {
    expect(
      segmentoDe({
        ocasioes: 1,
        ultimaOcasiao: mesesAtras(1),
        indicacoesFechadas: 0,
        now,
      }),
    ).toBe("NOVA");
  });

  it("RECORRENTE: 2+ ocasiões", () => {
    expect(
      segmentoDe({
        ocasioes: 3,
        ultimaOcasiao: mesesAtras(2),
        indicacoesFechadas: 0,
        now,
      }),
    ).toBe("RECORRENTE");
  });

  it("EMBAIXADORA: indicação fechada vence RECORRENTE", () => {
    expect(
      segmentoDe({
        ocasioes: 5,
        ultimaOcasiao: mesesAtras(2),
        indicacoesFechadas: 1,
        now,
      }),
    ).toBe("EMBAIXADORA");
  });

  it("EM_RECONEXAO: >12 meses sumida vence tudo (até embaixadora)", () => {
    expect(
      segmentoDe({
        ocasioes: 4,
        ultimaOcasiao: mesesAtras(13),
        indicacoesFechadas: 2,
        now,
      }),
    ).toBe("EM_RECONEXAO");
  });

  it("12 meses exatos ainda NÃO é reconexão (limite é > 12)", () => {
    expect(
      segmentoDe({
        ocasioes: 2,
        ultimaOcasiao: mesesAtras(12),
        indicacoesFechadas: 0,
        now,
      }),
    ).toBe("RECORRENTE");
  });

  it("sem nenhuma ocasião ainda = NOVA (acabou de entrar pelo clube)", () => {
    expect(
      segmentoDe({ ocasioes: 0, ultimaOcasiao: null, indicacoesFechadas: 0, now }),
    ).toBe("NOVA");
  });
});

describe("gerarCodigoIndicacao", () => {
  it("formato mi-xxxxxxxx sem caracteres ambíguos (0/O/1/I/L)", () => {
    for (let i = 0; i < 50; i++) {
      const code = gerarCodigoIndicacao();
      expect(code).toMatch(/^mi-[abcdefghjkmnpqrstuvwxyz23456789]{8}$/);
    }
  });

  it("não repete em uma amostra razoável", () => {
    const sample = new Set(
      Array.from({ length: 200 }, () => gerarCodigoIndicacao()),
    );
    expect(sample.size).toBe(200);
  });
});

describe("degrausAtingidos (escada de indicação)", () => {
  const ladder = [
    { nivel: 1, beneficio: "a" },
    { nivel: 3, beneficio: "b" },
    { nivel: 5, beneficio: "c" },
  ];

  it("0 fechadas = nenhum degrau", () => {
    expect(degrausAtingidos(ladder, 0)).toEqual([]);
  });

  it("1 fechada = só o 1º degrau", () => {
    expect(degrausAtingidos(ladder, 1).map((s) => s.nivel)).toEqual([1]);
  });

  it("4 fechadas = degraus 1 e 3", () => {
    expect(degrausAtingidos(ladder, 4).map((s) => s.nivel)).toEqual([1, 3]);
  });

  it("7 fechadas = escada completa, em ordem", () => {
    expect(degrausAtingidos(ladder, 7).map((s) => s.nivel)).toEqual([1, 3, 5]);
  });
});
