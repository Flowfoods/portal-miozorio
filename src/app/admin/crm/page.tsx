import Link from "next/link";
import { DateTime } from "luxon";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const brl = (cents: number) =>
  (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  });

// Ordem e cor (token) de cada segmento RFV.
const SEGMENTOS = [
  { nome: "Campeãs", cor: "bg-mi-marrom" },
  { nome: "Fiéis", cor: "bg-mi-marrom/70" },
  { nome: "Promissoras", cor: "bg-mi-marrom/50" },
  { nome: "Em risco", cor: "bg-mi-marrom/30" },
  { nome: "Hibernando", cor: "bg-mi-cinza" },
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

export default async function CrmPage() {
  const [segGroups, funilGroups, ltvAgg, ultimoCalc] = await Promise.all([
    prisma.customer.groupBy({
      by: ["rfvSegmento"],
      where: { rfvSegmento: { not: null } },
      _count: { _all: true },
    }),
    prisma.customer.groupBy({
      by: ["funilEtapa"],
      where: { funilEtapa: { not: null } },
      _count: { _all: true },
    }),
    prisma.customer.aggregate({
      where: { ltvPrevistoCents: { not: null } },
      _sum: { ltvPrevistoCents: true },
      _avg: { ltvPrevistoCents: true },
    }),
    prisma.customer.findFirst({
      where: { rfvCalculadoEm: { not: null } },
      orderBy: { rfvCalculadoEm: "desc" },
      select: { rfvCalculadoEm: true },
    }),
  ]);

  const segCount = new Map(segGroups.map((g) => [g.rfvSegmento, g._count._all]));
  const funilCount = new Map(funilGroups.map((g) => [g.funilEtapa, g._count._all]));
  const baseTotal = segGroups.reduce((s, g) => s + g._count._all, 0);
  const ltvTotal = ltvAgg._sum.ltvPrevistoCents ?? 0;
  const ltvMedio = Math.round(ltvAgg._avg.ltvPrevistoCents ?? 0);
  const calcLabel = ultimoCalc?.rfvCalculadoEm
    ? DateTime.fromJSDate(ultimoCalc.rfvCalculadoEm)
        .setZone("America/Sao_Paulo")
        .toFormat("dd/MM 'às' HH:mm")
    : null;

  return (
    <>
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
      </div>

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
          {SEGMENTOS.map((s) => {
            const n = segCount.get(s.nome) ?? 0;
            const w = baseTotal > 0 ? Math.round((n / baseTotal) * 100) : 0;
            return (
              <Link
                key={s.nome}
                href={`/admin/crm/rfv?seg=${encodeURIComponent(s.nome)}`}
                className="flex items-center gap-3 rounded-mi bg-mi-branco px-4 py-3 shadow-suave transition hover:bg-mi-bege/40"
              >
                <span className="w-28 shrink-0 font-medium text-mi-marrom-escuro">
                  {s.nome}
                </span>
                <span className="h-2 flex-1 overflow-hidden rounded-full bg-mi-cinza/40">
                  <span className={`block h-full ${s.cor}`} style={{ width: `${w}%` }} />
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
              {funilCount.get(f.etapa as never) ?? 0}
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
        <Link href="/admin/clientes" className="rounded-mi border border-mi-cinza px-4 py-2 hover:bg-mi-bege/40">
          Todas as clientes →
        </Link>
      </div>
    </>
  );
}
