import Link from "next/link";
import { DateTime } from "luxon";
import AdminNav from "@/components/admin/AdminNav";
import { getResumo } from "@/lib/stats";

export const dynamic = "force-dynamic";

const brl = (cents: number) =>
  (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  });

const pct = (n: number) => `${Math.round(n * 100)}%`;

function Card({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-mi bg-mi-branco p-5 shadow-suave">
      <p className="text-xs uppercase tracking-wide text-mi-texto/60">{label}</p>
      <p className="mt-1 font-titulo text-2xl text-mi-marrom-escuro">{value}</p>
      {hint && <p className="mt-1 text-xs text-mi-texto/60">{hint}</p>}
    </div>
  );
}

export default async function ResumoPage({
  searchParams,
}: {
  searchParams: { mes?: string };
}) {
  const { resumo, label, mesAtual } = await getResumo(searchParams.mes);
  const sel = searchParams.mes && /^\d{4}-\d{2}$/.test(searchParams.mes)
    ? searchParams.mes
    : mesAtual;
  const selDt = DateTime.fromISO(`${sel}-01`);
  const prev = selDt.minus({ months: 1 }).toFormat("yyyy-MM");
  const next = selDt.plus({ months: 1 }).toFormat("yyyy-MM");
  const podeAvancar = next <= mesAtual;

  return (
    <>
      <AdminNav />
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl">Resumo</h1>
        <div className="flex items-center gap-2 text-sm">
          <Link
            href={`/admin/resumo?mes=${prev}`}
            className="rounded-mi border border-mi-cinza px-3 py-1.5"
          >
            ←
          </Link>
          <span className="min-w-36 text-center capitalize">{label}</span>
          {podeAvancar ? (
            <Link
              href={`/admin/resumo?mes=${next}`}
              className="rounded-mi border border-mi-cinza px-3 py-1.5"
            >
              →
            </Link>
          ) : (
            <span className="rounded-mi border border-mi-cinza/40 px-3 py-1.5 text-mi-texto/30">
              →
            </span>
          )}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card label="Faturamento" value={brl(resumo.faturamentoCents)} hint="atendimentos realizados" />
        <Card label="Atendimentos" value={String(resumo.atendimentos)} />
        <Card label="Ticket médio" value={brl(resumo.ticketMedioCents)} />
        <Card label="Ocupação" value={pct(resumo.ocupacao)} hint="da agenda até hoje" />
        <Card
          label="Faltas (no-show)"
          value={String(resumo.noShow)}
          hint={`${pct(resumo.noShowRate)} dos atendimentos`}
        />
        <Card label="Cancelamentos" value={String(resumo.canceladas)} />
        <Card
          label="Origem · Site"
          value={String(resumo.origem.site.atendimentos)}
          hint={brl(resumo.origem.site.faturamentoCents)}
        />
        <Card
          label="Origem · Telefone"
          value={String(resumo.origem.telefone.atendimentos)}
          hint={brl(resumo.origem.telefone.faturamentoCents)}
        />
      </div>

      <h2 className="mb-3 mt-8 font-titulo text-xl text-mi-marrom-escuro">
        Serviços mais fortes do mês
      </h2>
      {resumo.topServicos.length === 0 ? (
        <p className="text-sm text-mi-texto/60">
          Nenhum atendimento realizado neste mês ainda.
        </p>
      ) : (
        <div className="space-y-2">
          {resumo.topServicos.map((s) => (
            <div
              key={s.nome}
              className="flex items-center justify-between rounded-mi bg-mi-branco px-4 py-3 shadow-suave"
            >
              <span>
                {s.nome}{" "}
                <span className="text-sm text-mi-texto/60">
                  · {s.atendimentos}×
                </span>
              </span>
              <span className="font-medium text-mi-marrom-escuro">
                {brl(s.faturamentoCents)}
              </span>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
