import { describe, it, expect } from "vitest";
import {
  saldoDe,
  calcularBonusIndicacao,
  ehAutoindicacao,
  escopoPermiteBonus,
} from "@/lib/clube-pontos";

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

  it("estorno espelhado reverte o saldo (lançamento negativo, nunca deleção)", () => {
    // serviço +150, indicação +30, depois estornos espelhados -150 e -30.
    expect(
      saldoDe([
        { pontos: 150 },
        { pontos: 30 },
        { pontos: -150 },
        { pontos: -30 },
      ]),
    ).toBe(0);
  });
});

describe("calcularBonusIndicacao (indicação percentual)", () => {
  it("caso do prompt: 20% de 150 = 30", () => {
    expect(calcularBonusIndicacao(150, 20)).toBe(30);
  });

  it("arredonda para BAIXO (floor): 12,5% de 150 = 18,75 → 18", () => {
    expect(calcularBonusIndicacao(150, 12.5)).toBe(18);
  });

  it("floor em outro caso: 33% de 100 = 33", () => {
    expect(calcularBonusIndicacao(100, 33)).toBe(33);
  });

  it("piso de 1 ponto quando o cálculo dá > 0 e < 1 (0,5% de 150 = 0,75 → 1)", () => {
    expect(calcularBonusIndicacao(150, 0.5)).toBe(1);
  });

  it("base zero (indicada não pontuou) → 0", () => {
    expect(calcularBonusIndicacao(0, 20)).toBe(0);
  });

  it("percentual zero (programa sem repasse) → 0", () => {
    expect(calcularBonusIndicacao(150, 0)).toBe(0);
  });

  it("clampa percentual acima de 100 (150% vira 100%)", () => {
    expect(calcularBonusIndicacao(150, 150)).toBe(150);
  });

  it("clampa percentual negativo em 0", () => {
    expect(calcularBonusIndicacao(150, -10)).toBe(0);
  });
});

describe("ehAutoindicacao (antifraude)", () => {
  const base = {
    indicadaId: "ind-1",
    embaixadoraId: "emb-1",
    indicadaPhone: "+5521999990001",
    embaixadoraPhone: "+5521999990002",
    indicadaEmail: "ana@ex.com",
    embaixadoraEmail: "bia@ex.com",
  };

  it("pessoas distintas → não bloqueia", () => {
    expect(ehAutoindicacao(base)).toBe(false);
  });

  it("mesmo clientId → bloqueia", () => {
    expect(ehAutoindicacao({ ...base, embaixadoraId: "ind-1" })).toBe(true);
  });

  it("mesmo telefone → bloqueia", () => {
    expect(
      ehAutoindicacao({ ...base, embaixadoraPhone: base.indicadaPhone }),
    ).toBe(true);
  });

  it("mesmo e-mail (case-insensitive) → bloqueia", () => {
    expect(ehAutoindicacao({ ...base, embaixadoraEmail: "ANA@EX.COM" })).toBe(
      true,
    );
  });

  it("e-mails ausentes não causam falso positivo", () => {
    expect(
      ehAutoindicacao({
        ...base,
        indicadaEmail: null,
        embaixadoraEmail: null,
      }),
    ).toBe(false);
  });
});

describe("escopoPermiteBonus (escopo da indicação)", () => {
  it("PRIMEIRO_ATENDIMENTO: credita se ainda não pagou", () => {
    expect(escopoPermiteBonus("PRIMEIRO_ATENDIMENTO", false)).toBe(true);
  });

  it("PRIMEIRO_ATENDIMENTO: NÃO credita se já pagou (inclui legado fixo)", () => {
    expect(escopoPermiteBonus("PRIMEIRO_ATENDIMENTO", true)).toBe(false);
  });

  it("TODOS_ATENDIMENTOS: credita mesmo já tendo pago antes", () => {
    expect(escopoPermiteBonus("TODOS_ATENDIMENTOS", true)).toBe(true);
  });
});
