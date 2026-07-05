import { describe, it, expect } from "vitest";
import {
  crmConfigSchema,
  DEFAULT_CRM_CONFIG,
  nomesSegmentos,
  diffCrmConfig,
} from "@/lib/crm-config";
import { scoreFixed, matchSegmento, segmentoRFV, type Cortes4 } from "@/lib/rfv";

describe("scoreFixed — faixas fixas configuráveis (F2)", () => {
  const recencia: Cortes4 = [30, 60, 120, 180];
  it("recência (invertida): até c1 = 5, acima de c4 = 1, bordas inclusivas", () => {
    expect(scoreFixed(0, recencia, true)).toBe(5);
    expect(scoreFixed(30, recencia, true)).toBe(5);
    expect(scoreFixed(31, recencia, true)).toBe(4);
    expect(scoreFixed(60, recencia, true)).toBe(4);
    expect(scoreFixed(120, recencia, true)).toBe(3);
    expect(scoreFixed(180, recencia, true)).toBe(2);
    expect(scoreFixed(181, recencia, true)).toBe(1);
  });
  const freq: Cortes4 = [1, 2, 3, 5];
  it("frequência (crescente): nota sobe ao ATINGIR cada corte", () => {
    expect(scoreFixed(0, freq)).toBe(1);
    expect(scoreFixed(1, freq)).toBe(2);
    expect(scoreFixed(2, freq)).toBe(3);
    expect(scoreFixed(3, freq)).toBe(4);
    expect(scoreFixed(4, freq)).toBe(4);
    expect(scoreFixed(5, freq)).toBe(5);
    expect(scoreFixed(99, freq)).toBe(5);
  });
});

describe("matchSegmento — regras ordenadas, primeira que casa vence", () => {
  const regras = DEFAULT_CRM_CONFIG.segmentos;
  it("reproduz a segmentoRFV legada em TODO o grid 1..5³ (125 combinações)", () => {
    for (let r = 1; r <= 5; r++)
      for (let f = 1; f <= 5; f++)
        for (let v = 1; v <= 5; v++) {
          expect(matchSegmento(r, f, v, regras)).toBe(segmentoRFV(r, f, v));
        }
  });
  it("nomes repetidos em regras diferentes funcionam (Em risco A/B)", () => {
    expect(matchSegmento(1, 4, 1, regras)).toBe("Em risco"); // fMin3
    expect(matchSegmento(1, 1, 4, regras)).toBe("Em risco"); // vMin3
    expect(matchSegmento(1, 1, 1, regras)).toBe("Hibernando");
  });
  it("nada casando → vale a última regra", () => {
    const rs = [
      { nome: "A", rMin: 5 as const },
      { nome: "Resto", fMin: 5 as const },
    ];
    expect(matchSegmento(1, 1, 1, rs)).toBe("Resto");
  });
});

describe("crmConfigSchema — validação", () => {
  it("aceita o DEFAULT", () => {
    expect(crmConfigSchema.safeParse(DEFAULT_CRM_CONFIG).success).toBe(true);
  });
  it("recusa cortes fora de ordem", () => {
    const bad = { ...DEFAULT_CRM_CONFIG, recenciaDias: [60, 30, 120, 180] };
    expect(crmConfigSchema.safeParse(bad).success).toBe(false);
  });
  it("recusa segmento sem nome ou lista vazia", () => {
    expect(
      crmConfigSchema.safeParse({ ...DEFAULT_CRM_CONFIG, segmentos: [] })
        .success,
    ).toBe(false);
    expect(
      crmConfigSchema.safeParse({
        ...DEFAULT_CRM_CONFIG,
        segmentos: [{ nome: "x" }],
      }).success,
    ).toBe(false);
  });
});

describe("nomesSegmentos + diffCrmConfig", () => {
  it("nomes únicos na ordem, sem repetir Em risco/Fiéis", () => {
    expect(nomesSegmentos(DEFAULT_CRM_CONFIG)).toEqual([
      "Campeãs",
      "Em risco",
      "Hibernando",
      "Fiéis",
      "Promissoras",
    ]);
  });
  it("diff em linguagem leiga: recência e limiar", () => {
    const depois = {
      ...DEFAULT_CRM_CONFIG,
      recenciaDias: [30, 60, 90, 150] as Cortes4,
      limiares: { ...DEFAULT_CRM_CONFIG.limiares, sumidaDias: 90 },
    };
    const d = diffCrmConfig(DEFAULT_CRM_CONFIG, depois);
    expect(d.some((x) => x.includes("Recência"))).toBe(true);
    expect(d.some((x) => x.includes("sumida"))).toBe(true);
    expect(d.length).toBe(2);
  });
  it("sem mudanças → diff vazio", () => {
    expect(diffCrmConfig(DEFAULT_CRM_CONFIG, DEFAULT_CRM_CONFIG)).toEqual([]);
  });
});
