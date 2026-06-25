import { DateTime } from "luxon";
import { getSettings } from "@/lib/settings";
import { formatBRL } from "@/lib/format";
import {
  resumoDoMes,
  serieMensal,
  breakdownDoMes,
  type Regime,
} from "@/lib/finance/queries";
import type { DRE } from "@/lib/finance/dre";
import FinanceSubnav from "@/components/admin/finance/FinanceSubnav";
import FinanceControls from "@/components/admin/finance/FinanceControls";
import { BarrasReceitaDespesa, Donut } from "@/components/admin/finance/Charts";

export const dynamic = "force-dynamic";

const pct = (v: number) => `${(v * 100).toFixed(1).replace(".", ",")}%`;

function parseMes(raw: string | undefined, tz: string): { ano: number; mes: number; iso: string } {
  const now = DateTime.now().setZone(tz);
  const d = raw && /^\d{4}-\d{2}$/.test(raw) ? DateTime.fromISO(`${raw}-01`) : now;
  const valido = d.isValid ? d : now;
  return { ano: valido.year, mes: valido.month, iso: valido.toFormat("yyyy-MM") };
}

export default async function FinanceiroDashboard({
  searchParams,
}: {
  searchParams: { mes?: string; regime?: string };
}) {
  const { timezone: tz } = await getSettings();
  const { ano, mes, iso } = parseMes(searchParams.mes, tz);
  const regime: Regime = searchParams.regime === "competencia" ? "competencia" : "caixa";

  const inicioSerie = DateTime.fromObject({ year: ano, month: mes }).minus({ months: 5 });
  const [{ dre, kpis, alertas }, serie, breakdown] = await Promise.all([
    resumoDoMes(ano, mes, regime),
    serieMensal(inicioSerie.toFormat("yyyy-MM"), iso, regime),
    breakdownDoMes(ano, mes, regime),
  ]);

  const tituloMes = DateTime.fromObject({ year: ano, month: mes })
    .setLocale("pt-BR")
    .toFormat("LLLL 'de' yyyy");

  return (
    <>
      <FinanceSubnav />

      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl">Financeiro</h1>
          <p className="text-sm capitalize text-mi-texto/70">{tituloMes}</p>
        </div>
        <FinanceControls mes={iso} regime={regime} />
      </div>

      {alertas.length > 0 && (
        <div className="mb-6 space-y-2">
          {alertas.map((a) => (
            <p key={a} className="rounded-mi bg-amber-50 px-4 py-2.5 text-sm text-amber-900 ring-1 ring-amber-200">
              {a}
            </p>
          ))}
        </div>
      )}

      {/* KPIs */}
      <section className="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card titulo="Resultado do mês" destaque>
          <span className={dre.lucroLiquidoCents >= 0 ? "text-emerald-700" : "text-red-700"}>
            {formatBRL(dre.lucroLiquidoCents)}
          </span>
        </Card>
        <Card titulo="Margem líquida">{pct(kpis.margemLiquidaPct)}</Card>
        <Card titulo="Margem de contribuição">{pct(kpis.margemContribuicaoPct)}</Card>
        <Card titulo="Ticket médio">
          {kpis.ticketMedioCents != null ? formatBRL(kpis.ticketMedioCents) : "—"}
        </Card>
        <Card titulo="Ponto de equilíbrio">
          {kpis.pontoEquilibrioCents != null ? (
            <>
              {formatBRL(kpis.pontoEquilibrioCents)}
              {kpis.pontoEquilibrioAtendimentos != null && (
                <span className="block text-xs font-normal text-mi-texto/60">
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
        <Card titulo="No-show no mês">
          {kpis.noShowCount}
          {kpis.noShowValorCents > 0 && (
            <span className="block text-xs font-normal text-mi-texto/60">
              {formatBRL(kpis.noShowValorCents)} potenciais
            </span>
          )}
        </Card>
      </section>

      {/* Gráfico comparativo */}
      <section className="mb-8">
        <h2 className="mb-3 text-xl">Receita × Despesa (6 meses)</h2>
        <BarrasReceitaDespesa serie={serie} />
      </section>

      {/* Donuts */}
      <section className="mb-8 grid gap-4 lg:grid-cols-2">
        <Donut
          titulo="Receita por origem"
          fatias={breakdown.receita.map((f) => ({ label: f.name, cents: f.cents, color: f.color }))}
        />
        <Donut
          titulo="Despesa por categoria"
          fatias={breakdown.despesa.map((f) => ({ label: f.name, cents: f.cents, color: f.color }))}
        />
      </section>

      {/* DRE */}
      <section>
        <h2 className="mb-3 text-xl">DRE do mês</h2>
        <DreTabela dre={dre} />
      </section>
    </>
  );
}

function Card({
  titulo,
  children,
  destaque,
}: {
  titulo: string;
  children: React.ReactNode;
  destaque?: boolean;
}) {
  return (
    <div className="rounded-mi bg-mi-superficie-elevada p-4 shadow-suave">
      <p className="font-corpo text-xs uppercase tracking-wide text-mi-texto/55">{titulo}</p>
      <p className={`mt-1 font-titulo ${destaque ? "text-2xl" : "text-xl"} text-mi-marrom-escuro`}>
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
                className={`border-b border-mi-cinza/50 ${isTotal ? "bg-mi-bege/40" : ""} ${
                  isFinal ? "border-b-0" : ""
                }`}
              >
                <td className={`px-4 py-2.5 ${isTotal ? "font-medium text-mi-marrom-escuro" : "text-mi-texto/80"}`}>
                  {l.rotulo}
                  {l.extra && <span className="ml-2 text-xs text-mi-texto/55">{l.extra}</span>}
                </td>
                <td
                  className={`px-4 py-2.5 text-right tabular-nums ${
                    isFinal
                      ? l.cents >= 0
                        ? "font-semibold text-emerald-700"
                        : "font-semibold text-red-700"
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
