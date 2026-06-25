import { describe, it, expect } from "vitest";
import {
  montarDRE,
  kpisDoMes,
  pontoDeEquilibrio,
  alertasDoMes,
  razao,
  type MovimentoMensal,
  type ReceitaMov,
  type DespesaMov,
} from "@/lib/finance/dre";

const rec = (
  amountCents: number,
  categoryCode: string | null = null,
  cardFeeCents = 0,
): ReceitaMov => ({ amountCents, cardFeeCents, categoryCode });

const desp = (
  amountCents: number,
  dreGroup: DespesaMov["dreGroup"],
  nature: DespesaMov["nature"] = null,
  isCmv = false,
): DespesaMov => ({ amountCents, dreGroup, nature, isCmv });

const mov = (over: Partial<MovimentoMensal>): MovimentoMensal => ({
  receitas: [],
  despesas: [],
  atendimentos: 0,
  noShowCount: 0,
  noShowValorCents: 0,
  ...over,
});

describe("razao (divisão segura)", () => {
  it("0 quando o denominador é 0 ou negativo", () => {
    expect(razao(10, 0)).toBe(0);
    expect(razao(10, -5)).toBe(0);
    expect(razao(50, 200)).toBe(0.25);
  });
});

describe("montarDRE — mês normal com lucro", () => {
  const m = mov({
    receitas: [
      rec(25000, "rev-social", 750), // social, taxa de cartão 3%
      rec(35000, "rev-social"),
      rec(30000, "rev-noiva"), // parcela de noiva
    ],
    despesas: [
      desp(5000, "deducao_venda", "variable"), // DAS sobre venda
      desp(12000, "custo_variavel", "variable", true), // insumos (CMV)
      desp(3000, "custo_variavel", "variable"), // deslocamento
      desp(20000, "custo_fixo", "fixed"), // aluguel
      desp(15000, "pro_labore", null), // pró-labore
    ],
    atendimentos: 3,
    noShowCount: 1,
    noShowValorCents: 25000,
  });
  const dre = montarDRE(m);

  it("segue a ordem e os valores do DRE", () => {
    expect(dre.receitaBrutaCents).toBe(90000);
    expect(dre.deducoesCents).toBe(5750); // 750 cartão + 5000 DAS
    expect(dre.receitaLiquidaCents).toBe(84250);
    expect(dre.custosVariaveisCents).toBe(15000); // 12000 + 3000
    expect(dre.margemContribuicaoCents).toBe(69250);
    expect(dre.custosFixosCents).toBe(20000);
    expect(dre.resultadoOperacionalCents).toBe(49250);
    expect(dre.proLaboreCents).toBe(15000);
    expect(dre.lucroLiquidoCents).toBe(34250);
  });

  it("percentuais com base na receita bruta", () => {
    expect(dre.margemContribuicaoPct).toBeCloseTo(69250 / 90000, 6);
    expect(dre.margemLiquidaPct).toBeCloseTo(34250 / 90000, 6);
  });

  it("KPIs: ticket médio, CMV, custo fixo, receita por origem", () => {
    const k = kpisDoMes(m, dre);
    expect(k.ticketMedioCents).toBe(30000); // 90000 / 3
    expect(k.cmvPct).toBeCloseTo(12000 / 90000, 6);
    expect(k.custoFixoSobreReceitaPct).toBeCloseTo(20000 / 90000, 6);
    expect(k.receitaPorOrigem).toEqual({ "rev-social": 60000, "rev-noiva": 30000 });
    expect(k.despesaFixoCents).toBe(20000);
    expect(k.despesaVariavelCents).toBe(20000); // 5000 + 12000 + 3000
    expect(k.noShowCount).toBe(1);
    expect(k.noShowValorCents).toBe(25000);
  });

  it("ponto de equilíbrio em R$ e em atendimentos", () => {
    const pe = pontoDeEquilibrio(dre, 30000);
    // 20000 / 0.769444… ≈ 25993 centavos
    expect(pe.reaisCents).toBe(Math.round(20000 / (69250 / 90000)));
    expect(pe.atendimentos).toBe(1); // ceil(25993 / 30000)
  });

  it("sem alertas (lucro, custo fixo e CMV dentro da faixa)", () => {
    expect(alertasDoMes(dre, kpisDoMes(m, dre))).toEqual([]);
  });
});

describe("montarDRE — mês só com despesa (sem receita)", () => {
  const m = mov({ despesas: [desp(20000, "custo_fixo", "fixed")] });
  const dre = montarDRE(m);

  it("zera receita e fecha no prejuízo", () => {
    expect(dre.receitaBrutaCents).toBe(0);
    expect(dre.receitaLiquidaCents).toBe(0);
    expect(dre.margemContribuicaoPct).toBe(0);
    expect(dre.lucroLiquidoCents).toBe(-20000);
  });

  it("sem ponto de equilíbrio nem ticket médio", () => {
    const k = kpisDoMes(m, dre);
    expect(k.ticketMedioCents).toBeNull();
    expect(k.pontoEquilibrioCents).toBeNull();
    expect(k.pontoEquilibrioAtendimentos).toBeNull();
  });

  it("alerta de mês sem receita com despesa", () => {
    const alertas = alertasDoMes(dre, kpisDoMes(m, dre));
    expect(alertas).toContain(
      "Mês sem receita registrada e com despesas lançadas.",
    );
  });
});

describe("noiva parcelada em 3 meses (isolamento por mês)", () => {
  // O sinal entra num mês; cada parcela é um lançamento no SEU mês de competência.
  // No mês do sinal, só o sinal compõe a receita.
  it("o mês do sinal vê apenas o sinal", () => {
    const m = mov({
      receitas: [rec(30000, "rev-noiva")], // sinal R$300
      atendimentos: 0, // evento ainda não ocorreu (receita manual)
    });
    const dre = montarDRE(m);
    expect(dre.receitaBrutaCents).toBe(30000);
    const k = kpisDoMes(m, dre);
    expect(k.receitaPorOrigem).toEqual({ "rev-noiva": 30000 });
    expect(k.ticketMedioCents).toBeNull(); // sem atendimento concluído no mês
  });
});

describe("despesa sem dreGroup vira custo variável (não some do DRE)", () => {
  it("entra nos custos variáveis", () => {
    const m = mov({
      receitas: [rec(10000)],
      despesas: [desp(4000, null, null)],
    });
    const dre = montarDRE(m);
    expect(dre.custosVariaveisCents).toBe(4000);
    expect(dre.margemContribuicaoCents).toBe(6000);
  });
});

describe("alertas de custo fixo e CMV acima da faixa", () => {
  it("dispara os dois alertas", () => {
    const m = mov({
      receitas: [rec(10000, "rev-social")],
      despesas: [
        desp(5000, "custo_fixo", "fixed"), // 50% > 40%
        desp(4000, "custo_variavel", "variable", true), // CMV 40% > 30%
      ],
    });
    const dre = montarDRE(m);
    const alertas = alertasDoMes(dre, kpisDoMes(m, dre));
    expect(alertas.some((a) => a.includes("Custo fixo"))).toBe(true);
    expect(alertas.some((a) => a.includes("CMV"))).toBe(true);
  });
});
