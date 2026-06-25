import type { CostNature, DreGroup } from "@prisma/client";

/**
 * Núcleo financeiro PURO (sem banco) — DRE, KPIs e ponto de equilíbrio.
 * Recebe o movimento de um mês JÁ FILTRADO pelo regime (caixa vs competência);
 * a escolha do regime e as fronteiras de mês (America/Sao_Paulo) vivem em
 * src/lib/finance/queries.ts. Tudo em centavos (Int). Espelha a seção 2.5/2.6.
 */

export interface ReceitaMov {
  amountCents: number;
  cardFeeCents: number; // taxa de cartão desta entrada (dedução sobre venda)
  categoryCode: string | null; // p/ receita por origem
}

export interface DespesaMov {
  amountCents: number;
  dreGroup: DreGroup | null; // null = não classificada → tratada como custo variável
  nature: CostNature | null; // p/ donut fixo vs variável
  isCmv: boolean; // insumo/descartável → entra no CMV
}

export interface MovimentoMensal {
  receitas: ReceitaMov[];
  despesas: DespesaMov[];
  atendimentos: number; // bookings concluídos no mês (ticket médio / PE em atendimentos)
  noShowCount: number; // no_show no mês (impacto)
  noShowValorCents: number; // receita potencial perdida
}

export interface DRE {
  receitaBrutaCents: number;
  deducoesCents: number;
  receitaLiquidaCents: number;
  custosVariaveisCents: number;
  margemContribuicaoCents: number;
  margemContribuicaoPct: number; // 0–1, base receita bruta
  custosFixosCents: number;
  resultadoOperacionalCents: number;
  proLaboreCents: number;
  lucroLiquidoCents: number;
  margemLiquidaPct: number; // 0–1, base receita bruta
}

export interface KPIs {
  resultadoCents: number;
  margemLiquidaPct: number;
  margemContribuicaoPct: number;
  pontoEquilibrioCents: number | null; // null se MC% ≤ 0
  pontoEquilibrioAtendimentos: number | null;
  ticketMedioCents: number | null; // null se nenhum atendimento
  cmvPct: number; // insumos ÷ receita bruta
  custoFixoSobreReceitaPct: number;
  receitaPorOrigem: Record<string, number>; // categoryCode → centavos
  despesaFixoCents: number;
  despesaVariavelCents: number;
  noShowCount: number;
  noShowValorCents: number;
}

const soma = <T>(xs: T[], f: (x: T) => number): number =>
  xs.reduce((acc, x) => acc + f(x), 0);

/** Razão segura: 0 quando o denominador é 0/negativo (evita NaN/Infinity). */
export function razao(parte: number, total: number): number {
  return total > 0 ? parte / total : 0;
}

/** DRE mensal na ordem exata da seção 2.5. */
export function montarDRE(mov: MovimentoMensal): DRE {
  const receitaBruta = soma(mov.receitas, (r) => r.amountCents);
  const cardFees = soma(mov.receitas, (r) => r.cardFeeCents);
  const deducoesExp = soma(
    mov.despesas.filter((d) => d.dreGroup === "deducao_venda"),
    (d) => d.amountCents,
  );
  const deducoes = cardFees + deducoesExp;
  const receitaLiquida = receitaBruta - deducoes;

  // Despesa sem dreGroup definido cai em custo variável (não some do DRE).
  const custosVariaveis = soma(
    mov.despesas.filter(
      (d) => d.dreGroup === "custo_variavel" || d.dreGroup === null,
    ),
    (d) => d.amountCents,
  );
  const margemContribuicao = receitaLiquida - custosVariaveis;
  const custosFixos = soma(
    mov.despesas.filter((d) => d.dreGroup === "custo_fixo"),
    (d) => d.amountCents,
  );
  const resultadoOperacional = margemContribuicao - custosFixos;
  const proLabore = soma(
    mov.despesas.filter((d) => d.dreGroup === "pro_labore"),
    (d) => d.amountCents,
  );
  const lucroLiquido = resultadoOperacional - proLabore;

  return {
    receitaBrutaCents: receitaBruta,
    deducoesCents: deducoes,
    receitaLiquidaCents: receitaLiquida,
    custosVariaveisCents: custosVariaveis,
    margemContribuicaoCents: margemContribuicao,
    margemContribuicaoPct: razao(margemContribuicao, receitaBruta),
    custosFixosCents: custosFixos,
    resultadoOperacionalCents: resultadoOperacional,
    proLaboreCents: proLabore,
    lucroLiquidoCents: lucroLiquido,
    margemLiquidaPct: razao(lucroLiquido, receitaBruta),
  };
}

/**
 * Ponto de equilíbrio (seção 2.6): Custos Fixos ÷ Margem de Contribuição %.
 * Em R$ e em nº de atendimentos (via ticket médio). null quando MC% ≤ 0
 * (não há contribuição positiva — não existe ponto de equilíbrio).
 */
export function pontoDeEquilibrio(
  dre: DRE,
  ticketMedioCents: number | null,
): { reaisCents: number | null; atendimentos: number | null } {
  if (dre.margemContribuicaoPct <= 0) {
    return { reaisCents: null, atendimentos: null };
  }
  const reaisCents = Math.round(
    dre.custosFixosCents / dre.margemContribuicaoPct,
  );
  const atendimentos =
    ticketMedioCents && ticketMedioCents > 0
      ? Math.ceil(reaisCents / ticketMedioCents)
      : null;
  return { reaisCents, atendimentos };
}

/** KPIs do mês (seção 2.6), derivados do movimento + DRE. */
export function kpisDoMes(mov: MovimentoMensal, dre: DRE): KPIs {
  const ticketMedioCents =
    mov.atendimentos > 0
      ? Math.round(dre.receitaBrutaCents / mov.atendimentos)
      : null;

  const pe = pontoDeEquilibrio(dre, ticketMedioCents);

  const cmv = soma(
    mov.despesas.filter((d) => d.isCmv),
    (d) => d.amountCents,
  );

  const receitaPorOrigem: Record<string, number> = {};
  for (const r of mov.receitas) {
    const key = r.categoryCode ?? "sem-categoria";
    receitaPorOrigem[key] = (receitaPorOrigem[key] ?? 0) + r.amountCents;
  }

  const despesaFixo = soma(
    mov.despesas.filter((d) => d.nature === "fixed"),
    (d) => d.amountCents,
  );
  const despesaVariavel = soma(
    mov.despesas.filter((d) => d.nature === "variable"),
    (d) => d.amountCents,
  );

  return {
    resultadoCents: dre.lucroLiquidoCents,
    margemLiquidaPct: dre.margemLiquidaPct,
    margemContribuicaoPct: dre.margemContribuicaoPct,
    pontoEquilibrioCents: pe.reaisCents,
    pontoEquilibrioAtendimentos: pe.atendimentos,
    ticketMedioCents,
    cmvPct: razao(cmv, dre.receitaBrutaCents),
    custoFixoSobreReceitaPct: razao(dre.custosFixosCents, dre.receitaBrutaCents),
    receitaPorOrigem,
    despesaFixoCents: despesaFixo,
    despesaVariavelCents: despesaVariavel,
    noShowCount: mov.noShowCount,
    noShowValorCents: mov.noShowValorCents,
  };
}

export interface AlertaFaixas {
  custoFixoPctMax: number; // ex.: 0.40 — alerta se custo fixo > 40% da receita
  cmvPctMax: number; // ex.: 0.30 — alerta se CMV > 30% da receita
}

export const ALERTA_FAIXAS_PADRAO: AlertaFaixas = {
  custoFixoPctMax: 0.4,
  cmvPctMax: 0.3,
};

/** Alertas inteligentes (banner discreto do dashboard). Puro. */
export function alertasDoMes(
  dre: DRE,
  kpis: KPIs,
  faixas: AlertaFaixas = ALERTA_FAIXAS_PADRAO,
): string[] {
  const out: string[] = [];
  if (dre.receitaBrutaCents === 0 && dre.lucroLiquidoCents < 0) {
    out.push("Mês sem receita registrada e com despesas lançadas.");
  } else if (dre.lucroLiquidoCents < 0) {
    out.push("O mês fechou no prejuízo.");
  }
  if (
    dre.receitaBrutaCents > 0 &&
    kpis.custoFixoSobreReceitaPct > faixas.custoFixoPctMax
  ) {
    out.push(
      `Custo fixo passou de ${Math.round(faixas.custoFixoPctMax * 100)}% da receita.`,
    );
  }
  if (dre.receitaBrutaCents > 0 && kpis.cmvPct > faixas.cmvPctMax) {
    out.push(
      `CMV (insumos) acima de ${Math.round(faixas.cmvPctMax * 100)}% da receita.`,
    );
  }
  return out;
}
