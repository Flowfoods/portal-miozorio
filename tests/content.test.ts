import { describe, it, expect } from "vitest";
import { parseTabela, aplicarTemplate, CONTENT_FIELDS } from "@/lib/content";

describe("parseTabela (tabela editável 'Rótulo | Valor')", () => {
  it("converte linhas em pares { o, v }", () => {
    expect(parseTabela("Maquiagem | R$ 380\nCabelo | R$ 450")).toEqual([
      { o: "Maquiagem", v: "R$ 380" },
      { o: "Cabelo", v: "R$ 450" },
    ]);
  });

  it("ignora linhas sem separador ou incompletas", () => {
    expect(parseTabela("sem separador\nMaquiagem | R$ 380\n   ")).toEqual([
      { o: "Maquiagem", v: "R$ 380" },
    ]);
  });

  it("texto vazio = lista vazia", () => {
    expect(parseTabela("")).toEqual([]);
  });

  it("preserva '|' que faça parte do valor", () => {
    expect(parseTabela("Combo | A | B")).toEqual([{ o: "Combo", v: "A | B" }]);
  });
});

describe("aplicarTemplate (mensagens editáveis pela Mi)", () => {
  it("troca os placeholders pelos valores", () => {
    expect(
      aplicarTemplate("Oi, {nome}! Seu horário de {servico} é {data}.", {
        nome: "Ana",
        servico: "Maquiagem",
        data: "20/06 13:30",
      }),
    ).toBe("Oi, Ana! Seu horário de Maquiagem é 20/06 13:30.");
  });

  it("remove placeholders sem valor (não vaza '{xxx}')", () => {
    expect(aplicarTemplate("Pontos{motivo}!", {})).toBe("Pontos!");
  });

  it("repete o mesmo placeholder quantas vezes aparecer", () => {
    expect(aplicarTemplate("{nome}, {nome}", { nome: "Mi" })).toBe("Mi, Mi");
  });

  it("todas as chaves msg.* existem no registry com default não vazio", () => {
    const msgs = CONTENT_FIELDS.filter((f) => f.key.startsWith("msg."));
    expect(msgs.length).toBeGreaterThanOrEqual(7);
    for (const f of msgs) expect(f.default.trim().length).toBeGreaterThan(0);
  });
});
