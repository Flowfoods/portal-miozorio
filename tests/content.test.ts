import { describe, it, expect } from "vitest";
import { parseTabela } from "@/lib/content";

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
