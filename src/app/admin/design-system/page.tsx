import StatCard from "@/components/ui/StatCard";
import DeltaBadge from "@/components/ui/DeltaBadge";
import SegmentedControl from "@/components/ui/SegmentedControl";
import ChartCard from "@/components/ui/ChartCard";
import EstadoVazio from "@/components/ui/EstadoVazio";
import BarrasChart from "@/components/ui/charts/BarrasChart";
import AreaChart from "@/components/ui/charts/AreaChart";
import RoscaChart from "@/components/ui/charts/RoscaChart";
import GaugeChart from "@/components/ui/charts/GaugeChart";
import BarrasHChart from "@/components/ui/charts/BarrasHChart";
import { ChartCarregando, ChartVazio, ChartErro } from "@/components/ui/charts/estados";
import { fmtBRL, fmtInt } from "@/lib/charts/theme";

/**
 * Vitrine interna do design system (não linkada na navegação). Mostra tokens
 * e componentes com dados de exemplo — o "catálogo vivo" do redesign V1/V2.
 */
export const dynamic = "force-dynamic";

const ESCALA = [
  ["50", "#F7F4F1"],
  ["100", "#EDE6E0"],
  ["200", "#DCCEC3"],
  ["300", "#C4AF9F"],
  ["400", "#A78F7B"],
  ["500", "#8A7361"],
  ["600", "#75604F"],
  ["700", "#6B5849"],
  ["800", "#4E4137"],
  ["900", "#332B24"],
] as const;

const APOIO = [
  ["sucesso", "#7A8B6F", "#46573B"],
  ["alerta", "#C08552", "#7D5128"],
  ["erro", "#A65D57", "#7E3A35"],
] as const;

export default function DesignSystemPage({
  searchParams,
}: {
  searchParams: { seg?: string };
}) {
  const seg = searchParams.seg ?? "mes";
  return (
    <>
      <h1 className="mb-1 text-3xl">Design system</h1>
      <p className="mb-8 font-corpo text-corpo text-mi-marrom-700">
        Catálogo interno do redesign — tokens e componentes com dados de
        exemplo. Nada aqui é linkado para a Mi.
      </p>

      <h2 className="mb-3 font-titulo text-xl text-mi-marrom-escuro">
        Escala mi-marrom
      </h2>
      <div className="mb-3 grid grid-cols-5 gap-2 sm:grid-cols-10">
        {ESCALA.map(([n, hex]) => (
          <div key={n} className="text-center">
            <div
              className="h-14 rounded-mi border border-mi-marrom-100"
              style={{ backgroundColor: hex }}
            />
            <p className="mt-1 font-corpo text-micro text-mi-marrom-700">{n}</p>
          </div>
        ))}
      </div>
      <p className="mb-8 font-corpo text-rotulo text-mi-marrom-700">
        500 é a marca (~4,4:1 sobre branco — só texto grande). Texto corrido
        sobre claro: 700+. Cores de apoio: superfície clara enfeita, a “tinta”
        escreve.
      </p>
      <div className="mb-10 flex flex-wrap gap-4">
        {APOIO.map(([nome, sup, tinta]) => (
          <div
            key={nome}
            className="flex items-center gap-3 rounded-mi border border-mi-marrom-100 bg-mi-branco px-4 py-3 shadow-card"
          >
            <span className="h-8 w-8 rounded-full" style={{ backgroundColor: sup }} />
            <div>
              <p className="font-corpo text-rotulo font-medium" style={{ color: tinta }}>
                mi-{nome}
              </p>
              <p className="font-corpo text-micro text-mi-marrom-500">
                {sup} · tinta {tinta}
              </p>
            </div>
          </div>
        ))}
      </div>

      <h2 className="mb-3 font-titulo text-xl text-mi-marrom-escuro">
        Tipografia
      </h2>
      <div className="mb-10 space-y-2 rounded-2xl border border-mi-marrom-100 bg-mi-branco p-6 shadow-card">
        <p className="font-corpo text-kpi tabular-nums text-mi-marrom-900">R$ 8.540</p>
        <p className="font-corpo text-kpi-sm tabular-nums text-mi-marrom-900">R$ 8.540</p>
        <p className="font-corpo text-titulo text-mi-marrom-900">Título de seção 20/600</p>
        <p className="font-corpo text-corpo text-mi-texto">Corpo 15/400 — texto de leitura.</p>
        <p className="font-corpo text-rotulo text-mi-marrom-700">Rótulo 13/500 — legenda sob o número.</p>
        <p className="font-corpo text-micro uppercase text-mi-marrom-700">Micro 11/500 uppercase</p>
      </div>

      <h2 className="mb-3 font-titulo text-xl text-mi-marrom-escuro">
        StatCard — herói + default
      </h2>
      <div className="mb-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          variant="hero"
          rotulo="Faturamento do mês"
          valor="R$ 8.540"
          delta={0.22}
          periodo="vs mês anterior"
        />
        <StatCard rotulo="Atendimentos" valor="47" delta={0.08} periodo="vs mês anterior" />
        <StatCard rotulo="Ticket médio" valor="R$ 182" delta={-0.034} periodo="vs mês anterior" />
        <StatCard
          rotulo="Faltas (no-show)"
          valor="2"
          delta={-0.5}
          deltaInverso
          periodo="vs mês anterior"
        />
      </div>

      <h2 className="mb-3 font-titulo text-xl text-mi-marrom-escuro">
        DeltaBadge · SegmentedControl
      </h2>
      <div className="mb-10 flex flex-wrap items-center gap-4">
        <DeltaBadge valor={0.22} />
        <DeltaBadge valor={-0.08} />
        <DeltaBadge valor={-0.5} inverso />
        <DeltaBadge valor={null} />
        <SegmentedControl
          ariaLabel="Período de exemplo"
          items={[
            { label: "Semana", href: "?seg=semana", ativo: seg === "semana" },
            { label: "Mês", href: "?seg=mes", ativo: seg === "mes" },
            { label: "Ano", href: "?seg=ano", ativo: seg === "ano" },
          ]}
        />
      </div>

      <h2 className="mb-3 font-titulo text-xl text-mi-marrom-escuro">
        ChartCard · EstadoVazio
      </h2>
      <div className="mb-10 grid gap-4 lg:grid-cols-2">
        <ChartCard
          titulo="Faturamento ao longo do mês"
          controle={
            <SegmentedControl
              ariaLabel="Período do gráfico"
              items={[
                { label: "30 dias", href: "?g=30", ativo: true },
                { label: "90 dias", href: "?g=90", ativo: false },
              ]}
            />
          }
          resumoA11y="Faturamento diário crescendo de R$ 120 no dia 1º até R$ 460 no dia 30, com pico de R$ 520 no dia 27."
        >
          <AreaChart
            dados={[120, 180, 150, 240, 210, 320, 280, 260, 350, 330, 410, 380, 460, 520, 460].map(
              (v, i) => ({ label: `${i * 2 + 1}/8`, valor: v * 100 }),
            )}
            formato="brl"
          />
        </ChartCard>
        <EstadoVazio
          titulo="Nenhum atendimento ainda"
          descricao="Quando a primeira cliente agendar, o movimento do mês aparece aqui."
          cta={{ label: "Criar agendamento", href: "/admin" }}
        />
      </div>

      <h2 className="mb-3 font-titulo text-xl text-mi-marrom-escuro">
        Gráficos — tipos (V2)
      </h2>
      <div className="mb-10 grid gap-4 lg:grid-cols-2">
        <ChartCard
          titulo="Atendimentos por dia da semana"
          resumoA11y="Sábado é o dia de pico com 14 atendimentos; domingo tem 11; os dias de semana ficam entre 1 e 4."
        >
          <BarrasChart
            dados={[
              { label: "Seg", valor: 1 },
              { label: "Ter", valor: 2 },
              { label: "Qua", valor: 2 },
              { label: "Qui", valor: 4 },
              { label: "Sex", valor: 3 },
              { label: "Sáb", valor: 14 },
              { label: "Dom", valor: 11 },
            ]}
            formato="int"
            unidade="atendimento(s)"
          />
        </ChartCard>
        <ChartCard
          titulo="Taxa de ocupação da agenda"
          resumoA11y="A agenda do período está 69% ocupada."
        >
          <div className="flex h-full min-h-[200px] items-center justify-center">
            <GaugeChart
              fracao={0.69}
              rotulo="da agenda ocupada"
              detalhe="Horários livres no sábado à tarde — vale divulgar."
            />
          </div>
        </ChartCard>
        <ChartCard
          titulo="Distribuição por tipo de serviço"
          resumoA11y="Maquiagem social representa 45% dos atendimentos, penteado 25%, sobrancelha 15%, escova 10% e outros 5%."
        >
          <RoscaChart
            fatias={[
              { label: "Maquiagem social", valor: 4500 },
              { label: "Penteado", valor: 2500 },
              { label: "Sobrancelha", valor: 1500 },
              { label: "Escova", valor: 1000 },
              { label: "Hidratação", valor: 300 },
              { label: "Reconstrução", valor: 150 },
              { label: "Cronograma", valor: 50 },
            ]}
            formatoTotal={(t) => fmtInt(t)}
          />
        </ChartCard>
        <ChartCard
          titulo="Serviços mais vendidos"
          resumoA11y="Ranking: maquiagem social lidera com R$ 3.200, seguida de penteado com R$ 1.900."
        >
          <BarrasHChart
            dados={[
              { label: "Maquiagem social", valor: 320000, extra: "18×" },
              { label: "Penteado", valor: 190000, extra: "11×" },
              { label: "Escova", valor: 82500, extra: "5×" },
              { label: "Sobrancelha", valor: 45000, extra: "6×" },
              { label: "Hidratação", valor: 25500, extra: "1×" },
            ]}
            formato={fmtBRL}
          />
        </ChartCard>
      </div>

      <h2 className="mb-3 font-titulo text-xl text-mi-marrom-escuro">
        Gráficos — os três estados obrigatórios
      </h2>
      <div className="mb-10 grid gap-4 lg:grid-cols-3">
        <ChartCard titulo="Carregando (skeleton com formato)">
          <ChartCarregando formato="barras" />
        </ChartCard>
        <ChartCard titulo="Vazio (convite, não área morta)">
          <ChartVazio
            titulo="Ainda sem movimento"
            descricao="Assim que os primeiros atendimentos forem concluídos, o gráfico da semana nasce aqui."
          />
        </ChartCard>
        <ChartCard titulo="Erro (discreto, com recarregar)">
          <ChartErro recarregarHref="/admin/design-system" />
        </ChartCard>
      </div>
    </>
  );
}
