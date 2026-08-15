import Link from "next/link";
import { DateTime } from "luxon";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatBRL } from "@/lib/format";
import { TZ_PADRAO } from "@/lib/periods";
import { PRESETS_AUTOMATICOS } from "@/lib/campanhas/service";
import { ativarPresetAction, alternarStatusAction } from "./actions";

export const dynamic = "force-dynamic";

const STATUS_TOM: Record<string, string> = {
  RASCUNHO: "text-mi-texto/80",
  ATIVA: "text-emerald-700",
  PAUSADA: "text-amber-700",
  CONCLUIDA: "text-mi-texto/80",
};

export default async function CampanhasPage() {
  await requireAdmin();
  const inicioMes = DateTime.now().setZone(TZ_PADRAO).startOf("month").toJSDate();
  const [campanhas, msgsMes, enviosAgg] = await Promise.all([
    prisma.campanha.findMany({
      orderBy: { criadoEm: "desc" },
      include: { _count: { select: { envios: true } } },
    }),
    prisma.whatsAppMessage.count({
      where: { tipo: "CAMPANHA", criadoEm: { gte: inicioMes } },
    }),
    prisma.campanhaEnvio.aggregate({
      where: { whatsappMessageId: { not: null } },
      _count: { _all: true, convertidoEm: true },
      _sum: { receitaCents: true },
    }),
  ]);
  const enviosTotal = enviosAgg._count._all;
  const convertidas = enviosAgg._count.convertidoEm;
  const taxa = enviosTotal ? Math.round((convertidas / enviosTotal) * 100) : 0;
  const receita = enviosAgg._sum.receitaCents ?? 0;
  const auto = campanhas.filter((c) => c.tipo === "AUTOMATICA");
  const pontuais = campanhas.filter((c) => c.tipo === "PONTUAL");
  const ativa = (rec: string) => auto.find((c) => c.recorrencia === rec)?.status === "ATIVA";

  return (
    <>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl">Campanhas</h1>
        <Link href="/admin/campanhas/nova" className="rounded-mi bg-mi-marrom-escuro px-4 py-2 text-sm text-white">
          + Nova campanha
        </Link>
      </div>

      <section className="mb-6 grid grid-cols-3 gap-3">
        <div className="rounded-mi bg-mi-branco p-4 shadow-suave">
          <p className="text-xs uppercase tracking-wide text-mi-texto/80">Mensagens no mês</p>
          <p className="mt-1 font-titulo text-2xl text-mi-marrom-escuro">{msgsMes}</p>
        </div>
        <div className="rounded-mi bg-mi-branco p-4 shadow-suave">
          <p className="text-xs uppercase tracking-wide text-mi-texto/80">Conversão média</p>
          <p className="mt-1 font-titulo text-2xl text-mi-marrom-escuro">
            {enviosTotal ? `${taxa}%` : "—"}
          </p>
        </div>
        <div className="rounded-mi bg-mi-branco p-4 shadow-suave">
          <p className="text-xs uppercase tracking-wide text-mi-texto/80">Receita atribuída</p>
          <p className="mt-1 font-titulo text-2xl text-mi-marrom-escuro">
            {receita ? formatBRL(receita) : "—"}
          </p>
        </div>
      </section>

      <section className="mb-8">
        <h2 className="mb-2 text-lg">Automáticas</h2>
        <p className="mb-3 text-sm text-mi-texto/80">
          Ligam sozinhas nos gatilhos. Com aprovação: a lista fica pendente pra você conferir antes de enviar.
        </p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {PRESETS_AUTOMATICOS.map((p) => {
            const on = ativa(p.recorrencia);
            const camp = auto.find((c) => c.recorrencia === p.recorrencia);
            return (
              <div key={p.recorrencia} className="rounded-mi bg-mi-branco p-4 shadow-suave">
                <p className="font-corpo text-mi-marrom-escuro">{p.nome}</p>
                <p className="mt-1 line-clamp-2 text-xs text-mi-texto/80">{p.corpo}</p>
                <div className="mt-3 flex items-center gap-2">
                  {on ? (
                    <>
                      <span className="text-xs text-emerald-700">● Ativa</span>
                      {camp && (
                        <form action={alternarStatusAction.bind(null, camp.id, false)}>
                          <button className="text-xs text-mi-marrom-escuro underline">pausar</button>
                        </form>
                      )}
                      {camp && (
                        <Link href={`/admin/campanhas/${camp.id}`} className="text-xs text-mi-marrom-escuro underline">
                          ver
                        </Link>
                      )}
                    </>
                  ) : (
                    <form action={ativarPresetAction.bind(null, p.recorrencia)}>
                      <button className="rounded-mi border border-mi-marrom px-3 py-1 text-xs text-mi-marrom-escuro hover:bg-mi-marrom-escuro hover:text-white">
                        Ativar
                      </button>
                    </form>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-lg">Pontuais</h2>
        {pontuais.length === 0 ? (
          <p className="rounded-mi bg-mi-branco p-6 text-center text-sm text-mi-texto/80 shadow-suave">
            Nenhuma campanha pontual ainda. Crie a primeira 💛
          </p>
        ) : (
          <ul className="divide-y divide-mi-cinza/60 rounded-mi bg-mi-branco shadow-suave">
            {pontuais.map((c) => (
              <li key={c.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <Link href={`/admin/campanhas/${c.id}`} className="text-mi-marrom-escuro hover:underline">
                    {c.nome}
                  </Link>
                  <p className="text-xs text-mi-texto/80">{c._count.envios} envio(s)</p>
                </div>
                <span className={`text-xs ${STATUS_TOM[c.status] ?? ""}`}>{c.status}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
