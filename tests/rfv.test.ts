import { describe, it, expect } from "vitest";
import {
  quintilCuts,
  scoreFromCuts,
  segmentoRFV,
  ltvPrevistoCents,
  computeRFV,
  type RFVRow,
} from "@/lib/rfv";

describe("quintilCuts", () => {
  it("base vazia → cortes zerados", () => {
    expect(quintilCuts([])).toEqual([0, 0, 0, 0]);
  });
  it("cortes crescentes sobre valores ordenados", () => {
    const cuts = quintilCuts([10, 20, 30, 40, 50, 60, 70, 80, 90, 100]);
    expect(cuts[0]).toBeLessThanOrEqual(cuts[1]!);
    expect(cuts[1]).toBeLessThanOrEqual(cuts[2]!);
    expect(cuts[2]).toBeLessThanOrEqual(cuts[3]!);
  });
});

describe("scoreFromCuts", () => {
  const cuts: [number, number, number, number] = [20, 40, 60, 80];
  it("valor alto → score 5 (maior é melhor)", () => {
    expect(scoreFromCuts(100, cuts)).toBe(5);
  });
  it("valor baixo → score 1", () => {
    expect(scoreFromCuts(5, cuts)).toBe(1);
  });
  it("invert: valor baixo (poucos dias) → score 5", () => {
    expect(scoreFromCuts(5, cuts, true)).toBe(5);
    expect(scoreFromCuts(100, cuts, true)).toBe(1);
  });
  it("sempre dentro de 1..5", () => {
    for (const v of [-10, 0, 25, 55, 999]) {
      const s = scoreFromCuts(v, cuts);
      expect(s).toBeGreaterThanOrEqual(1);
      expect(s).toBeLessThanOrEqual(5);
    }
  });
});

describe("segmentoRFV", () => {
  it("Campeãs: tudo alto", () => {
    expect(segmentoRFV(5, 5, 5)).toBe("Campeãs");
    expect(segmentoRFV(4, 4, 4)).toBe("Campeãs");
  });
  it("Em risco: recência baixa mas já foi boa", () => {
    expect(segmentoRFV(2, 4, 4)).toBe("Em risco");
    expect(segmentoRFV(1, 1, 4)).toBe("Em risco");
  });
  it("Hibernando: recência baixa e fraca em F e V", () => {
    expect(segmentoRFV(1, 1, 1)).toBe("Hibernando");
    expect(segmentoRFV(2, 2, 2)).toBe("Hibernando");
  });
  it("Fiéis: recente e frequente", () => {
    expect(segmentoRFV(4, 5, 2)).toBe("Fiéis");
    expect(segmentoRFV(3, 3, 1)).toBe("Fiéis");
  });
  it("Promissoras: recente, poucas visitas", () => {
    expect(segmentoRFV(5, 1, 4)).toBe("Promissoras");
    expect(segmentoRFV(4, 2, 1)).toBe("Promissoras");
  });
  it("exaustivo: todo (r,f,v) ∈ 1..5 retorna um segmento não-vazio", () => {
    for (let r = 1; r <= 5; r++)
      for (let f = 1; f <= 5; f++)
        for (let v = 1; v <= 5; v++)
          expect(segmentoRFV(r, f, v).length).toBeGreaterThan(0);
  });
});

describe("ltvPrevistoCents", () => {
  it("ticket × frequência × horizonte (padrão 3 anos)", () => {
    expect(ltvPrevistoCents(15000, 4)).toBe(15000 * 4 * 3);
  });
  it("horizonte custom", () => {
    expect(ltvPrevistoCents(10000, 2, 5)).toBe(10000 * 2 * 5);
  });
  it("frequência 0 → 0", () => {
    expect(ltvPrevistoCents(20000, 0)).toBe(0);
  });
});

describe("computeRFV", () => {
  const rows: RFVRow[] = [
    { id: "a", r_days: 5, f: 8, v: 120000, total: 10, v_total: 150000 }, // top
    { id: "b", r_days: 400, f: 0, v: 0, total: 1, v_total: 9000 }, // sumida
    { id: "c", r_days: 30, f: 2, v: 18000, total: 2, v_total: 18000 }, // média
  ];
  it("retorna um score por linha com segmento e LTV", () => {
    const out = computeRFV(rows);
    expect(out).toHaveLength(3);
    const a = out.find((x) => x.id === "a")!;
    const b = out.find((x) => x.id === "b")!;
    // a (recente, frequente, valiosa) deve pontuar melhor que b (sumida) na recência
    expect(a.rScore).toBeGreaterThan(b.rScore);
    // ltv da cliente sem visita na janela = 0
    expect(b.ltvPrevistoCents).toBe(0);
    // ltv da cliente ativa = ticket × freq × 3
    expect(a.ltvPrevistoCents).toBe(Math.round(120000 / 8) * 8 * 3);
  });
});
