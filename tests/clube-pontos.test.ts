import { describe, it, expect } from "vitest";
import { saldoDe } from "@/lib/clube-pontos";

describe("saldoDe (Clube por pontos — Anexo 1)", () => {
  it("lista vazia = 0", () => {
    expect(saldoDe([])).toBe(0);
  });

  it("soma créditos e débitos", () => {
    expect(
      saldoDe([
        { pontos: 100 }, // serviço
        { pontos: 100 }, // indicação
        { pontos: -150 }, // resgate
      ]),
    ).toBe(50);
  });

  it("pode ficar zerado após resgate exato", () => {
    expect(saldoDe([{ pontos: 200 }, { pontos: -200 }])).toBe(0);
  });
});
