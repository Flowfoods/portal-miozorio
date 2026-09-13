import { describe, it, expect } from "vitest";
import { chaveServico, mesmoServico } from "@/lib/servico-nome";

describe("A6 — dois nomes são o mesmo serviço?", () => {
  it("caixa não diferencia", () => {
    expect(mesmoServico("Buço", "BUÇO")).toBe(true);
    expect(mesmoServico("buço", "Buço")).toBe(true);
  });

  it("acento não diferencia — foi assim que 'Buço' duplicou", () => {
    expect(mesmoServico("Buço", "Buco")).toBe(true);
    expect(mesmoServico("Sobrancelha", "Sobrâncelha")).toBe(true);
  });

  it("espaço sobrando não diferencia", () => {
    expect(mesmoServico("  Buço  ", "Buço")).toBe(true);
    expect(mesmoServico("Design  de   sobrancelha", "Design de sobrancelha")).toBe(
      true,
    );
  });

  it("serviços de verdade diferentes continuam diferentes", () => {
    expect(mesmoServico("Buço", "Buço e queixo")).toBe(false);
    expect(mesmoServico("Escova", "Escova modelada")).toBe(false);
    expect(mesmoServico("Design de sobrancelha", "Henna de sobrancelha")).toBe(
      false,
    );
  });

  it("a chave é estável e normalizada", () => {
    expect(chaveServico("  BUÇO  ")).toBe("buco");
    expect(chaveServico("Design  de Sobrancelha")).toBe("design de sobrancelha");
  });

  it("string vazia não quebra", () => {
    expect(chaveServico("")).toBe("");
    expect(chaveServico("   ")).toBe("");
  });
});
