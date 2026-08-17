import { DateTime } from "luxon";
import { getSettings } from "@/lib/settings";
import { formatBRL } from "@/lib/format";
import {
  resumoDoPeriodo,
  serieMensal,
  breakdownDoPeriodo,
  type Regime,
} from "@/lib/finance/queries";
import type { DRE } from "@/lib/finance/dre";
import {
  buildPeriod,
  periodoAnterior,
  formatPeriodoExtenso,
} from "@/lib/periods";
import { periodoDaRequest } from "@/lib/periods-server";
import PeriodSelector from "@/components/admin/PeriodSelector";
import FinanceSubnav from "@/components/admin/finance/FinanceSubnav";
import FinanceControls from "@/components/admin/finance/FinanceControls";
import { BarrasReceitaDespesa } from "@/components/admin/finance/Charts";
import StatCard from "@/components/ui/StatCard";
import ChartCard from "@/components/ui/ChartCard";
import RoscaChart from "@/components/ui/charts/RoscaChart";
import { ChartVazio } from "@/components/ui/charts/estados";
import { fmtBRL } from "@/lib/charts/theme";

export const dynamic = "force-dynamic";

const pct = (v: number) => `${(v * 100).toFixed(1).replace(".", ",")}%`;

/** Variação % vs período anterior; null quando a base é 0 (sem comparação). */
function variacao(atual: number, anterior: number): number | null {
  if (anterior === 0) return null;
  return (atual - anterior) / Math.abs(anterior);
}

export default async function FinanceiroDashboard({
  searchParams,
}: {
  searchParams: {
    mes?: string;
    regime?: string;
    periodo?: string;
    de?: string;
    ate?: string;
  };
}) {
  const { timezone: tz } = await getSettings();
  const regime: Regime = searchParams.regime === "competencia" ? "competencia" : "caixa";
  const now = DateTime.now().setZone(tz);

  // Período (F3): URL → cookie → default = MÊS CORRENTE (comportamento antigo).
  // O legado ?mes=YYYY-MM segue funcionando (links salvos) como range do mês.
  const mesLegado =
    searchParams.mes && /^\d{4}-\d{2}$/.test(searchParams.mes)
      ? DateTime.fromISO(`${searchParams.mes}-01`, { zone: tz })
      : null;
  const mesRange = (d: DateTime) =>
    buildPeriod(
      "personalizado",
      d.startOf("month").toISODate() ?? "",
      d.endOf("month").toISODate() ?? "",
      tz,
    );
  const pr = mesLegado?.isValid
    ? { period: mesRange(mesLegado), error: undefined }
    : periodoDaRequest("financeiro", searchParams, {
        zone: tz,
        fallbackPeriod: mesRange(now),
      });
  const period = pr.period;
  const anterior = periodoAnterior(period, tz);

  const fimSerie = DateTime.fromISO(period.ateISO, { zone: tz });
  const [{ dre, kpis, alertas }, ant, serie, breakdown] = await Promise.all([
    resumoDoPeriodo(period, regime),
    resumoDoPeriodo(anterior, regime),
    serieMensal(
      fimSerie.minus({ months: 5 }).toFormat("yyyy-MM"),
      fimSerie.toFormat("yyyy-MM"),
      regime,
    ),
    breakdownDoPeriodo(period, regime),
  ]);

  const saiuAtual = dre.receitaBrutaCents - dre.lucroLiquidoCents;
  const saiuAnt = ant.dre.receitaBrutaCents - ant.dre.lucroLiquidoCents;
  const comparacoes = [
    { rotulo: "Entrou", atual: dre.receitaBrutaCents, var: variacao(dre.receitaBrutaCents, ant.dre.receitaBrutaCents) },
    { rotulo: "Saiu", atual: saiuAtual, var: variacao(saiuAtual, saiuAnt), inverso: true },
    { rotulo: "Resultado", atual: dre.lucroLiquidoCents, var: variacao(dre.lucroLiquidoCents, ant.dre.lucroLiquidoCents) },
  ];

  return (
    <>
      <FinanceSubnav />

      <div className="mb-2 flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-3xl">Financeiro</h1>
        <FinanceControls regime={regime} />
      </div>

      <PeriodSelector
        modulo="financeiro"
        preset={period.preset}
        deISO={period.deISO}
        ateISO={period.ateISO}
        extenso={formatPeriodoExtenso(period, tz)}
        error={pr.error}
      />

      {alertas.length > 0 && (
        <div className="mb-6 space-y-2">
          {alertas.map((a) => (
            <p key={a} className="rounded-mi bg-mi-alerta/10 px-4 py-2.5 text-sm text-mi-alerta-tinta ring-1 ring-mi-alerta/40">
              {a}
            </p>
          ))}
        </div>
      )}

      {/* KPIs — UM herói (o resultado), demais brancos, deltas vs anterior */}
      <section className="mb-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          variant="hero"
          rotulo="Resultado do período"
          valor={formatBRL(dre.lucroLiquidoCents)}
          delta={comparacoes[2]!.var}
          periodo={`vs ${formatPeriodoExtenso(anterior, tz)}`}
        />
        <StatCard
          rotulo="Entrou"
          valor={formatBRL(dre.receitaBrutaCents)}
          delta={comparacoes[0]!.var}
          periodo="vs período anterior"
        />
        <StatCard
          rotulo="Saiu"
          valor={formatBRL(saiuAtual)}
          delta={comparacoes[1]!.var}
          deltaInverso
          periodo="vs período anterior"
        />
        <StatCard
          rotulo="Ticket médio"
          valor={kpis.ticketMedioCents != null ? formatBRL(kpis.ticketMedioCents) : "—"}
          periodo="por atendimento"
        />
      </section>

      {/* Indicadores secundários, compactos */}
      <section className="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card titulo="Margem líquida">{pct(kpis.margemLiquidaPct)}</Card>
        <Card titulo="Margem de contribuição">{pct(kpis.margemContribuicaoPct)}</Card>
        <Card titulo="Ponto de equilíbrio">
          {kpis.pontoEquilibrioCents != null ? (
            <>
              {formatBRL(kpis.pontoEquilibrioCents)}
              {kpis.pontoEquilibrioAtendimentos != null && (
                <span className="block text-xs font-normal text-mi-texto/80">
                  ≈ {kpis.pontoEquilibrioAtendimentos} atendimento(s)
                </span>
              )}
            </>
          ) : (
            "—"
          )}
        </Card>
        <Card titulo="CMV (insumos)">{pct(kpis.cmvPct)}</Card>
        <Card titulo="Custo fixo / receita">{pct(kpis.custoFixoSobreReceitaPct)}</Card>
        <Card titulo="Faltas no mês">
          {kpis.noShowCount}
          {kpis.noShowValorCents > 0 && (
            <span className="block text-xs font-normal text-mi-texto/80">
              {formatBRL(kpis.noShowValorCents)} potenciais
            </span>
          )}
        </Card>
      </section>

      {/* Gráfico comparativo */}
      <ChartCard
        titulo="Receita × Despesa (6 meses)"
        className="mb-4"
        resumoA11y={`Comparativo mensal de receita e despesa dos últimos 6 meses, com linha de resultado. Resultado do período atual: ${formatBRL(dre.lucroLiquidoCents)}.`}
      >
        <BarrasReceitaDespesa serie={serie} />
      </ChartCard>

      {/* Composição por categoria (paleta de dados fixa, máx. 6 fatias) */}
      <section className="mb-8 grid gap-4 lg:grid-cols-2">
        <ChartCard
          titulo="Receita por origem"
          resumoA11y={
            breakdown.receita.length
              ? `Receita por origem: ${breakdown.receita.map((f) => f.name).join(", ")}.`
              : "Sem receita no período."
          }
        >
          {breakdown.receita.length === 0 ? (
            <ChartVazio
              titulo="Nada entrou ainda"
              descricao="A composição da receita aparece aqui quando os primeiros valores forem lançados."
              altura={180}
            />
          ) : (
            <RoscaChart
              fatias={breakdown.receita.map((f) => ({ label: f.name, valor: f.cents }))}
              formatoTotal={fmtBRL}
            />
          )}
        </ChartCard>
        <ChartCard
          titulo="Despesa por categoria"
          resumoA11y={
            breakdown.despesa.length
              ? `Despesa por categoria: ${breakdown.despesa.map((f) => f.name).join(", ")}.`
              : "Sem despesa no período."
          }
        >
          {breakdown.despesa.length === 0 ? (
            <ChartVazio
              titulo="Nenhum custo lançado"
              descricao="Lance os custos do período para enxergar para onde o dinheiro vai."
              altura={180}
            />
          ) : (
            <RoscaChart
              fatias={breakdown.despesa.map((f) => ({ label: f.name, valor: f.cents }))}
              formatoTotal={fmtBRL}
            />
          )}
        </ChartCard>
      </section>

      {/* DRE */}
      <section>
        <h2 className="mb-3 text-xl">DRE do período</h2>
        <DreTabela dre={dre} />
      </section>
    </>
  );
}

function Card({
  titulo,
  children,
}: {
  titulo: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-mi-marrom-100 bg-mi-branco p-4 shadow-card">
      <p className="font-corpo text-micro uppercase text-mi-marrom-700">{titulo}</p>
      <p className="mt-1 font-corpo text-lg font-semibold tabular-nums text-mi-marrom-900">
        {children}
      </p>
    </div>
  );
}

function DreTabela({ dre }: { dre: DRE }) {
  const linhas: { rotulo: string; cents: number; tipo: "soma" | "sub" | "total"; extra?: string }[] = [
    { rotulo: "(+) Receita Bruta", cents: dre.receitaBrutaCents, tipo: "soma" },
    { rotulo: "(−) Deduções sobre venda", cents: -dre.deducoesCents, tipo: "sub" },
    { rotulo: "(=) Receita Líquida", cents: dre.receitaLiquidaCents, tipo: "total" },
    { rotulo: "(−) Custos Variáveis", cents: -dre.custosVariaveisCents, tipo: "sub" },
    {
      rotulo: "(=) Margem de Contribuição",
      cents: dre.margemContribuicaoCents,
      tipo: "total",
      extra: `${(dre.margemContribuicaoPct * 100).toFixed(1).replace(".", ",")}%`,
    },
    { rotulo: "(−) Custos Fixos", cents: -dre.custosFixosCents, tipo: "sub" },
    { rotulo: "(=) Resultado Operacional", cents: dre.resultadoOperacionalCents, tipo: "total" },
    { rotulo: "(−) Pró-labore", cents: -dre.proLaboreCents, tipo: "sub" },
    {
      rotulo: "(=) Lucro/Prejuízo Líquido",
      cents: dre.lucroLiquidoCents,
      tipo: "total",
      extra: `${(dre.margemLiquidaPct * 100).toFixed(1).replace(".", ",")}%`,
    },
  ];
  return (
    <div className="overflow-hidden rounded-mi bg-mi-superficie-elevada shadow-suave">
      <table className="w-full text-sm">
        <tbody>
          {linhas.map((l, i) => {
            const isTotal = l.tipo === "total";
            const isFinal = i === linhas.length - 1;
            return (
              <tr
                key={l.rotulo}
                className={`border-b border-mi-marrom-100/70 ${isTotal ? "bg-mi-marrom-50" : ""} ${
                  isFinal ? "border-b-0" : ""
                }`}
              >
                <td className={`px-4 py-2.5 ${isTotal ? "font-medium text-mi-marrom-escuro" : "text-mi-texto/80"}`}>
                  {l.rotulo}
                  {l.extra && <span className="ml-2 text-xs text-mi-texto/80">{l.extra}</span>}
                </td>
                <td
                  className={`px-4 py-2.5 text-right tabular-nums ${
                    isFinal
                      ? l.cents >= 0
                        ? "font-semibold text-mi-sucesso-tinta"
                        : "font-semibold text-mi-erro-tinta"
                      : isTotal
                        ? "font-medium text-mi-marrom-escuro"
                        : "text-mi-texto/80"
                  }`}
                >
                  {formatBRL(l.cents)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
