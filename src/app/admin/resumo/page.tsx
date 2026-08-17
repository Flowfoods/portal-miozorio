import Link from "next/link";
import { DateTime } from "luxon";
import { getResumo, getResumoRange, getResumoExtras } from "@/lib/stats";
import { getSettings } from "@/lib/settings";
import { formatPeriodoExtenso, periodoAnterior } from "@/lib/periods";
import { periodoDaRequest } from "@/lib/periods-server";
import PeriodSelector from "@/components/admin/PeriodSelector";
import StatCard from "@/components/ui/StatCard";
import ChartCard from "@/components/ui/ChartCard";
import AreaChart from "@/components/ui/charts/AreaChart";
import BarrasChart from "@/components/ui/charts/BarrasChart";
import BarrasHChart from "@/components/ui/charts/BarrasHChart";
import GaugeChart from "@/components/ui/charts/GaugeChart";
import { ChartVazio } from "@/components/ui/charts/estados";
import { fmtBRL } from "@/lib/charts/theme";

export const dynamic = "force-dynamic";

const brl = (cents: number) =>
  (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  });

const pct = (n: number) => `${Math.round(n * 100)}%`;

/** Variação relativa vs anterior; null quando não há base. */
function delta(atual: number, anterior: number): number | null {
  if (anterior === 0) return null;
  return (atual - anterior) / Math.abs(anterior);
}

export default async function ResumoPage({
  searchParams,
}: {
  searchParams: { mes?: string; periodo?: string; de?: string; ate?: string };
}) {
  const { timezone: tz } = await getSettings();

  // Período global (F3): se a URL/cookie trouxer período, ele manda; o legado
  // ?mes= e a navegação ←/→ mensal continuam funcionando no modo mês.
  const temPeriodo = Boolean(
    searchParams.periodo || searchParams.de || searchParams.ate,
  );
  const pr = temPeriodo
    ? periodoDaRequest("resumo", searchParams, { zone: tz, fallback: "ultimos30" })
    : null;

  const { resumo: resumoMes, label, mesAtual } = await getResumo(searchParams.mes);

  // Intervalo efetivo [start, end) — do período global ou do mês legado.
  const sel =
    searchParams.mes && /^\d{4}-\d{2}$/.test(searchParams.mes)
      ? searchParams.mes
      : mesAtual;
  const selDt = DateTime.fromISO(`${sel}-01`, { zone: tz });
  const start = pr
    ? DateTime.fromISO(pr.period.deISO, { zone: tz }).startOf("day")
    : selDt.startOf("month");
  const end = pr
    ? DateTime.fromISO(pr.period.ateISO, { zone: tz }).plus({ days: 1 }).startOf("day")
    : selDt.plus({ months: 1 }).startOf("month");

  // Período anterior equivalente (para os deltas dos KPIs).
  const antStart = pr
    ? DateTime.fromISO(periodoAnterior(pr.period, tz).deISO, { zone: tz }).startOf("day")
    : selDt.minus({ months: 1 }).startOf("month");
  const antEnd = pr
    ? DateTime.fromISO(periodoAnterior(pr.period, tz).ateISO, { zone: tz })
        .plus({ days: 1 })
        .startOf("day")
    : start;

  const [periodResumo, anterior, extras] = await Promise.all([
    pr ? getResumoRange(start, end) : Promise.resolve(null),
    getResumoRange(antStart, antEnd),
    getResumoExtras(start, end),
  ]);
  const resumo = periodResumo ?? resumoMes;

  const prev = selDt.minus({ months: 1 }).toFormat("yyyy-MM");
  const next = selDt.plus({ months: 1 }).toFormat("yyyy-MM");
  const podeAvancar = next <= mesAtual;

  const subtitulo = pr
    ? formatPeriodoExtenso(pr.period, tz)
    : label.charAt(0).toUpperCase() + label.slice(1);

  const semMovimento = resumo.atendimentos === 0;
  const topServicos = resumo.topServicos.slice(0, 5);

  return (
    <>
      {/* Cabeçalho: título em serifada + período; navegação à direita */}
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl">Resumo</h1>
          <p className="mt-0.5 font-corpo text-rotulo text-mi-marrom-700">
            {subtitulo}
          </p>
        </div>
        {!pr && (
          <div className="flex items-center gap-2">
            <nav
              aria-label="Navegar entre meses"
              className="inline-flex items-center gap-1 rounded-full border border-mi-marrom-100 bg-mi-branco p-1 shadow-card"
            >
              <Link
                href={`/admin/resumo?mes=${prev}`}
                aria-label="Mês anterior"
                className="inline-flex h-9 w-9 items-center justify-center rounded-full text-mi-marrom-800 hover:bg-mi-marrom-50"
              >
                ←
              </Link>
              <span className="min-w-32 text-center font-corpo text-rotulo capitalize text-mi-marrom-900">
                {label}
              </span>
              {podeAvancar ? (
                <Link
                  href={`/admin/resumo?mes=${next}`}
                  aria-label="Próximo mês"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full text-mi-marrom-800 hover:bg-mi-marrom-50"
                >
                  →
                </Link>
              ) : (
                <span
                  aria-hidden="true"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full text-mi-marrom-500"
                >
                  →
                </span>
              )}
            </nav>
            <Link
              href="/admin/resumo?periodo=ultimos30"
              className="font-corpo text-rotulo text-mi-marrom-800 underline underline-offset-4 hover:text-mi-marrom-900"
            >
              Por período
            </Link>
          </div>
        )}
      </div>

      {pr && (
        <PeriodSelector
          modulo="resumo"
          preset={pr.period.preset}
          deISO={pr.period.deISO}
          ateISO={pr.period.ateISO}
          extenso={formatPeriodoExtenso(pr.period, tz)}
          error={pr.error}
        />
      )}

      {/* Faixa de KPIs: UM herói (faturamento), demais brancos */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          variant="hero"
          rotulo="Faturamento"
          valor={brl(resumo.faturamentoCents)}
          delta={delta(resumo.faturamentoCents, anterior.faturamentoCents)}
          periodo="vs período anterior"
        />
        <StatCard
          rotulo="Atendimentos"
          valor={String(resumo.atendimentos)}
          delta={delta(resumo.atendimentos, anterior.atendimentos)}
          periodo="vs período anterior"
        />
        <StatCard
          rotulo="Ticket médio"
          valor={brl(resumo.ticketMedioCents)}
          delta={delta(resumo.ticketMedioCents, anterior.ticketMedioCents)}
          periodo="vs período anterior"
        />
        <StatCard
          rotulo="Novas clientes"
          valor={String(extras.novasClientes)}
          delta={delta(extras.novasClientes, extras.novasClientesAnterior)}
          periodo="vs período anterior"
        />
      </div>

      {/* Grade principal: área do faturamento + gauge de ocupação */}
      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        <ChartCard
          titulo="Faturamento ao longo do período"
          className="lg:col-span-2"
          resumoA11y={
            semMovimento
              ? "Sem faturamento no período."
              : `Faturamento total de ${brl(resumo.faturamentoCents)} em ${resumo.atendimentos} atendimentos no período.`
          }
        >
          {extras.serieDiaria.length === 0 || semMovimento ? (
            <ChartVazio
              titulo="Ainda sem faturamento aqui"
              descricao="Quando os primeiros atendimentos do período forem concluídos, a curva aparece neste espaço."
            />
          ) : (
            <AreaChart dados={extras.serieDiaria} formato="brl" />
          )}
        </ChartCard>
        <ChartCard
          titulo="Ocupação da agenda"
          resumoA11y={`A agenda do período está ${pct(resumo.ocupacao)} ocupada.`}
        >
          <div className="flex min-h-[200px] items-center justify-center">
            <GaugeChart
              fracao={resumo.ocupacao}
              rotulo="da agenda até hoje"
              detalhe={
                resumo.ocupacao < 0.5
                  ? "Tem horário sobrando — vale divulgar a agenda."
                  : resumo.ocupacao < 0.85
                    ? "Ritmo saudável, com espaço para encaixes."
                    : "Agenda quase cheia — considere abrir mais horários."
              }
            />
          </div>
        </ChartCard>
      </div>

      {/* Segunda faixa: dia da semana + serviços + próximos */}
      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <ChartCard
          titulo="Atendimentos por dia da semana"
          resumoA11y={
            semMovimento
              ? "Sem atendimentos no período."
              : `Distribuição dos ${resumo.atendimentos} atendimentos pela semana.`
          }
        >
          {semMovimento ? (
            <ChartVazio
              titulo="Semana ainda em branco"
              descricao="Os dias mais fortes do estúdio vão se desenhar aqui."
            />
          ) : (
            <BarrasChart
              dados={extras.porDiaSemana}
              formato="int"
              unidade="atendimento(s)"
              altura={200}
              larguraMinCat={34}
            />
          )}
        </ChartCard>
        <ChartCard
          titulo="Serviços mais procurados"
          resumoA11y={
            topServicos.length
              ? `Ranking: ${topServicos.map((s) => `${s.nome} com ${brl(s.faturamentoCents)}`).join(", ")}.`
              : "Sem serviços no período."
          }
        >
          {topServicos.length === 0 ? (
            <ChartVazio
              titulo="Nenhum serviço realizado"
              descricao="O ranking dos serviços queridinhos nasce com os primeiros atendimentos."
            />
          ) : (
            <BarrasHChart
              dados={topServicos.map((s) => ({
                label: s.nome,
                valor: s.faturamentoCents,
                extra: `${s.atendimentos}×`,
              }))}
              formato={fmtBRL}
            />
          )}
        </ChartCard>
        <section className="rounded-2xl border border-mi-marrom-100 bg-mi-branco p-5 shadow-card sm:p-6">
          <h2 className="mb-4 font-corpo text-[17px] font-semibold text-mi-marrom-900">
            Próximos agendamentos
          </h2>
          {extras.proximos.length === 0 ? (
            <ChartVazio
              titulo="Agenda livre à frente"
              descricao="Os próximos agendamentos confirmados aparecem aqui."
              altura={180}
            />
          ) : (
            <ol className="space-y-3">
              {extras.proximos.map((p) => {
                const dt = DateTime.fromJSDate(p.startsAt, { zone: tz }).setLocale("pt-BR");
                return (
                  <li key={p.id} className="flex items-center gap-3">
                    <span
                      aria-hidden="true"
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-mi-marrom-100 font-corpo text-rotulo font-semibold text-mi-marrom-800"
                    >
                      {p.cliente
                        .split(" ")
                        .map((n) => n[0])
                        .slice(0, 2)
                        .join("")}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-corpo text-rotulo font-medium text-mi-marrom-900">
                        {p.cliente}
                      </span>
                      <span className="block truncate font-corpo text-micro text-mi-marrom-700">
                        {p.servico}
                        {p.location === "home" ? " · domicílio" : ""}
                      </span>
                    </span>
                    <span className="shrink-0 rounded-full bg-mi-marrom-50 px-2.5 py-1 text-right font-corpo text-micro font-medium tabular-nums text-mi-marrom-800">
                      {dt.toFormat("ccc d/M")} · {dt.toFormat("HH:mm")}
                    </span>
                  </li>
                );
              })}
            </ol>
          )}
        </section>
      </div>

      {/* Faixa secundária: qualidade da operação */}
      <div className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          rotulo="Faltas (no-show)"
          valor={String(resumo.noShow)}
          delta={delta(resumo.noShow, anterior.noShow)}
          deltaInverso
          periodo={`${pct(resumo.noShowRate)} dos atendimentos`}
        />
        <StatCard
          rotulo="Cancelamentos"
          valor={String(resumo.canceladas)}
          delta={delta(resumo.canceladas, anterior.canceladas)}
          deltaInverso
          periodo="vs período anterior"
        />
        <StatCard
          rotulo="Taxa de retorno"
          valor={
            extras.retorno.total === 0
              ? "—"
              : pct(extras.retorno.recorrentes / extras.retorno.total)
          }
          periodo={
            extras.retorno.total === 0
              ? "aparece com os primeiros atendimentos"
              : `${extras.retorno.recorrentes} de ${extras.retorno.total} clientes já eram da casa`
          }
        />
        <StatCard
          rotulo="Origem · site × telefone"
          valor={`${resumo.origem.site.atendimentos} × ${resumo.origem.telefone.atendimentos}`}
          periodo={`${brl(resumo.origem.site.faturamentoCents)} × ${brl(resumo.origem.telefone.faturamentoCents)}`}
        />
      </div>
    </>
  );
}
