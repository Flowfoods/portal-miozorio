import Link from "next/link";
import { DateTime } from "luxon";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";
import { formatBRL } from "@/lib/format";
import { formatPeriodoExtenso } from "@/lib/periods";
import { periodoDaRequest } from "@/lib/periods-server";
import { getCrmConfig, nomesSegmentos } from "@/lib/crm-config";
import PeriodSelector from "@/components/admin/PeriodSelector";
import ClientesHubNav from "@/components/admin/ClientesHubNav";

export const dynamic = "force-dynamic";

const brl = (cents: number) =>
  (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  });

// Cores por posição — os NOMES vêm da régua editável (crm-config, F2).
const PALETA = [
  "bg-mi-marrom",
  "bg-mi-marrom/70",
  "bg-mi-marrom/50",
  "bg-mi-marrom/30",
  "bg-mi-cinza",
  "bg-mi-cinza/60",
] as const;

const FUNIL: { etapa: string; label: string }[] = [
  { etapa: "lead", label: "Lead" },
  { etapa: "previa_agendada", label: "Prévia agendada" },
  { etapa: "previa_feita", label: "Prévia feita" },
  { etapa: "contrato_fechado", label: "Contrato fechado" },
  { etapa: "evento", label: "Evento" },
  { etapa: "pos_evento", label: "Pós-evento" },
];

function Card({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-mi bg-mi-branco p-5 shadow-suave">
      <p className="text-xs uppercase tracking-wide text-mi-texto/60">{label}</p>
      <p className="mt-1 font-titulo text-2xl text-mi-marrom-escuro">{value}</p>
      {hint && <p className="mt-1 text-xs text-mi-texto/60">{hint}</p>}
    </div>
  );
}

export default async function CrmPage({
  searchParams,
}: {
  searchParams: { periodo?: string; de?: string; ate?: string };
}) {
  const { timezone: tz } = await getSettings();

  // Recorte de VISUALIZAÇÃO por período (F4) — não altera a lógica RFV (job diário).
  const pr = periodoDaRequest("crm", searchParams, {
    fallback: "ultimos30",
    zone: tz,
  });
  const range = { gte: pr.period.from, lte: pr.period.to };

  const [novasClientes, atendidos, faturamentoAgg] = await Promise.all([
    prisma.customer.count({ where: { createdAt: range } }),
    prisma.booking.count({ where: { status: "completed", startsAt: range } }),
    prisma.booking.aggregate({
      where: { status: "completed", startsAt: range },
      _sum: { priceCents: true },
    }),
  ]);

  const [segGroups, funilGroups, ltvAgg, ultimoCalc, recompraRows, aniversRows] =
    await Promise.all([
    prisma.customer.groupBy({
      by: ["rfvSegmento"],
      // noivas/deb saem da matriz mesmo que tenham score antigo (R2)
      where: { rfvSegmento: { not: null }, funilEtapa: null },
      _count: { _all: true },
    }),
    prisma.customer.groupBy({
      by: ["funilEtapa"],
      where: { funilEtapa: { not: null } },
      _count: { _all: true },
    }),
    prisma.customer.aggregate({
      where: { ltvPrevistoCents: { not: null }, funilEtapa: null },
      _sum: { ltvPrevistoCents: true },
      _avg: { ltvPrevistoCents: true },
    }),
    prisma.customer.findFirst({
      where: { rfvCalculadoEm: { not: null } },
      orderBy: { rfvCalculadoEm: "desc" },
      select: { rfvCalculadoEm: true },
    }),
    // Recompra: % da base (≥1 concluído, sem funil) que voltou (≥2 concluídos).
    prisma.$queryRawUnsafe<{ base: number; recompra: number }[]>(`
      SELECT count(*)::int AS base, count(*) FILTER (WHERE t.n >= 2)::int AS recompra
      FROM (SELECT customer_id, count(*) AS n FROM bookings
              WHERE status = 'completed' GROUP BY customer_id) t
      JOIN customers c ON c.id = t.customer_id
      WHERE c.funil_etapa IS NULL
    `),
    // Aniversariantes do mês corrente.
    prisma.$queryRawUnsafe<{ n: number }[]>(`
      SELECT count(*)::int AS n FROM customers
      WHERE birth_date IS NOT NULL
        AND EXTRACT(MONTH FROM birth_date) = EXTRACT(MONTH FROM now())
    `),
  ]);

  const segCount = new Map(segGroups.map((g) => [g.rfvSegmento, g._count._all]));
  // Nomes/ordem dos segmentos vêm da régua editável (F2); segmentos "órfãos"
  // (renomeados) ainda no banco aparecem no fim até o próximo recálculo.
  const cfgCrm = await getCrmConfig();
  const daRegua = nomesSegmentos(cfgCrm);
  const orfaos = Array.from(segCount.keys()).filter(
    (n): n is string => !!n && !daRegua.includes(n),
  );
  const segmentos = [...daRegua, ...orfaos];
  const funilCount = new Map(
    funilGroups.map((g) => [String(g.funilEtapa), g._count._all]),
  );
  const baseTotal = segGroups.reduce((s, g) => s + g._count._all, 0);
  const ltvTotal = ltvAgg._sum.ltvPrevistoCents ?? 0;
  const ltvMedio = Math.round(ltvAgg._avg.ltvPrevistoCents ?? 0);
  const calcLabel = ultimoCalc?.rfvCalculadoEm
    ? DateTime.fromJSDate(ultimoCalc.rfvCalculadoEm)
        .setZone("America/Sao_Paulo")
        .toFormat("dd/MM 'às' HH:mm")
    : null;
  const recompra = recompraRows[0] ?? { base: 0, recompra: 0 };
  const recompraPct =
    recompra.base > 0 ? Math.round((recompra.recompra / recompra.base) * 100) : 0;
  const aniversariantes = aniversRows[0]?.n ?? 0;

  return (
    <>
      <ClientesHubNav />

      {/* Atividade no período (F4 — recorte de visualização) */}
      <PeriodSelector
        modulo="crm"
        preset={pr.period.preset}
        deISO={pr.period.deISO}
        ateISO={pr.period.ateISO}
        extenso={formatPeriodoExtenso(pr.period, tz)}
        error={pr.error}
      />
      <section className="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-3">
        <Card
          label="Novas clientes no período"
          value={String(novasClientes)}
          hint="cadastros no intervalo"
        />
        <Card
          label="Atendimentos no período"
          value={String(atendidos)}
          hint="concluídos"
        />
        <Card
          label="Faturamento do período"
          value={formatBRL(faturamentoAgg._sum.priceCents ?? 0)}
          hint="atendimentos concluídos"
        />
      </section>

      <div className="mb-6">
        <h1 className="text-3xl">CRM</h1>
        <p className="mt-1 text-sm text-mi-texto/60">
          {calcLabel
            ? `Segmentação atualizada em ${calcLabel}.`
            : "A segmentação ainda não foi calculada — roda automaticamente todo dia."}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card label="Clientes na matriz" value={String(baseTotal)} hint="com atendimento (sem noivas/deb)" />
        <Card label="LTV previsto · total" value={brl(ltvTotal)} />
        <Card label="LTV previsto · médio" value={brl(ltvMedio)} />
        <Card
          label="Funil de noiva"
          value={String(Array.from(funilCount.values()).reduce((s, n) => s + n, 0))}
          hint="contatos em andamento"
        />
        <Card
          label="Taxa de recompra"
          value={`${recompraPct}%`}
          hint={`${recompra.recompra} de ${recompra.base} voltaram`}
        />
        <Card
          label="Aniversariantes do mês"
          value={String(aniversariantes)}
        />
      </div>

      <p className="mt-3 text-sm">
        <Link href="/admin/resumo" className="text-mi-marrom hover:underline">
          Ver os números do mês (faturamento, no-show, serviços) →
        </Link>
      </p>

      <h2 className="mb-3 mt-8 font-titulo text-xl text-mi-marrom-escuro">
        Segmentos (Matriz RFV)
      </h2>
      {baseTotal === 0 ? (
        <p className="text-sm text-mi-texto/60">
          Nenhum cliente segmentado ainda. Assim que houver atendimentos, a matriz
          é calculada no próximo ciclo diário.
        </p>
      ) : (
        <div className="space-y-2">
          {segmentos.map((nome, idx) => {
            const n = segCount.get(nome) ?? 0;
            const w = baseTotal > 0 ? Math.round((n / baseTotal) * 100) : 0;
            const cor = PALETA[Math.min(idx, PALETA.length - 1)]!;
            return (
              <Link
                key={nome}
                href={`/admin/crm/rfv?seg=${encodeURIComponent(nome)}`}
                className="flex items-center gap-3 rounded-mi bg-mi-branco px-4 py-3 shadow-suave transition hover:bg-mi-bege/40"
              >
                <span className="w-28 shrink-0 font-medium text-mi-marrom-escuro">
                  {nome}
                </span>
                <span className="h-2 flex-1 overflow-hidden rounded-full bg-mi-cinza/40">
                  <span className={`block h-full ${cor}`} style={{ width: `${w}%` }} />
                </span>
                <span className="w-10 shrink-0 text-right text-sm text-mi-texto/70">
                  {n}
                </span>
              </Link>
            );
          })}
        </div>
      )}

      <h2 className="mb-3 mt-8 font-titulo text-xl text-mi-marrom-escuro">Funil de noiva</h2>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {FUNIL.map((f) => (
          <Link
            key={f.etapa}
            href="/admin/crm/funil"
            className="rounded-mi bg-mi-branco p-4 text-center shadow-suave transition hover:bg-mi-bege/40"
          >
            <p className="font-titulo text-2xl text-mi-marrom-escuro">
              {funilCount.get(f.etapa) ?? 0}
            </p>
            <p className="mt-1 text-xs text-mi-texto/60">{f.label}</p>
          </Link>
        ))}
      </div>

      <div className="mt-8 flex flex-wrap gap-2 text-sm">
        <Link href="/admin/crm/rfv" className="rounded-mi border border-mi-cinza px-4 py-2 hover:bg-mi-bege/40">
          Ver segmentos →
        </Link>
        <Link href="/admin/crm/funil" className="rounded-mi border border-mi-cinza px-4 py-2 hover:bg-mi-bege/40">
          Funil de noiva →
        </Link>
        <Link href="/admin/crm/jornadas" className="rounded-mi border border-mi-cinza px-4 py-2 hover:bg-mi-bege/40">
          Jornadas →
        </Link>
        <Link href="/admin/crm/config" className="rounded-mi border border-mi-cinza px-4 py-2 hover:bg-mi-bege/40">
          Configurações do CRM →
        </Link>
        <Link href="/admin/clientes" className="rounded-mi border border-mi-cinza px-4 py-2 hover:bg-mi-bege/40">
          Todas as clientes →
        </Link>
      </div>
    </>
  );
}
