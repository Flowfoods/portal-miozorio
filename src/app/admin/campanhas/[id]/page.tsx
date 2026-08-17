import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { contarSegmento, type SegmentoConfig } from "@/lib/campanhas/segmento";
import { metricasCampanha } from "@/lib/campanhas/service";
import { formatBRL } from "@/lib/format";
import {
  dispararAction,
  dispararTesteAction,
  aprovarPendentesAction,
} from "../actions";

export const dynamic = "force-dynamic";

function Card({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-mi bg-mi-branco p-4 shadow-suave">
      <p className="text-xs uppercase tracking-wide text-mi-texto/80">{label}</p>
      <p className="mt-1 font-titulo text-2xl text-mi-marrom-escuro">{value}</p>
    </div>
  );
}

export default async function CampanhaDetalhePage({
  params,
}: {
  params: { id: string };
}) {
  await requireAdmin();
  const camp = await prisma.campanha.findUnique({ where: { id: params.id } });
  if (!camp) notFound();

  const [publico, m] = await Promise.all([
    contarSegmento(camp.segmentoConfig as SegmentoConfig),
    metricasCampanha(camp.id),
  ]);

  return (
    <>
      <div className="mb-2">
        <Link href="/admin/campanhas" className="text-sm text-mi-marrom-escuro underline">
          ← Campanhas
        </Link>
      </div>
      <h1 className="text-3xl">{camp.nome}</h1>
      <p className="mb-4 text-sm text-mi-texto/80">
        {camp.tipo === "AUTOMATICA" ? "Automática" : "Pontual"} · {camp.status}
      </p>

      <div className="mb-4 rounded-mi bg-mi-branco p-4 shadow-suave">
        <p className="text-sm text-mi-texto/80">Mensagem</p>
        <p className="mt-1 whitespace-pre-wrap text-mi-texto">{camp.corpo}</p>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Card label="Público" value={String(publico)} />
        <Card label="Enviadas" value={String(m.enviadas)} />
        <Card label="Entregues" value={String(m.entregues)} />
        <Card label="Convertidas" value={String(m.convertidas)} />
        <Card label="Receita atribuída" value={m.receitaCents ? formatBRL(m.receitaCents) : "—"} />
        <Card label="Pendentes" value={String(m.pendentes)} />
      </div>

      <div className="flex flex-wrap gap-3">
        <form action={dispararTesteAction.bind(null, camp.id)}>
          <button className="rounded-mi border border-mi-marrom px-4 py-2 text-sm text-mi-marrom-escuro hover:bg-mi-marrom-escuro hover:text-white">
            🧪 Enviar teste (só p/ a Mi)
          </button>
        </form>
        {camp.tipo === "PONTUAL" && (
          <form action={dispararAction.bind(null, camp.id)}>
            <button className="rounded-mi bg-mi-marrom-escuro px-4 py-2 text-sm text-white">
              Disparar para {publico} cliente(s)
            </button>
          </form>
        )}
        {m.pendentes > 0 && (
          <form action={aprovarPendentesAction.bind(null, camp.id)}>
            <button className="rounded-mi bg-mi-sucesso-tinta px-4 py-2 text-sm text-white">
              Aprovar e enviar {m.pendentes} pendente(s)
            </button>
          </form>
        )}
      </div>
    </>
  );
}
