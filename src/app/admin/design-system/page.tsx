import StatCard from "@/components/ui/StatCard";
import DeltaBadge from "@/components/ui/DeltaBadge";
import SegmentedControl from "@/components/ui/SegmentedControl";
import ChartCard from "@/components/ui/ChartCard";
import EstadoVazio from "@/components/ui/EstadoVazio";

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
        ChartCard (área do gráfico entra na V2) · EstadoVazio
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
        >
          <div className="flex h-48 items-center justify-center rounded-mi bg-mi-marrom-50 font-corpo text-rotulo text-mi-marrom-700">
            área do gráfico (V2)
          </div>
        </ChartCard>
        <EstadoVazio
          titulo="Nenhum atendimento ainda"
          descricao="Quando a primeira cliente agendar, o movimento do mês aparece aqui."
          cta={{ label: "Criar agendamento", href: "/admin" }}
        />
      </div>
    </>
  );
}
