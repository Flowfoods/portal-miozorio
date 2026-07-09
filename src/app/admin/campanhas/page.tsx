import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PRESETS_AUTOMATICOS } from "@/lib/campanhas/service";
import { ativarPresetAction, alternarStatusAction } from "./actions";

export const dynamic = "force-dynamic";

const STATUS_TOM: Record<string, string> = {
  RASCUNHO: "text-mi-texto/60",
  ATIVA: "text-emerald-700",
  PAUSADA: "text-amber-700",
  CONCLUIDA: "text-mi-texto/50",
};

export default async function CampanhasPage() {
  await requireAdmin();
  const campanhas = await prisma.campanha.findMany({
    orderBy: { criadoEm: "desc" },
    include: { _count: { select: { envios: true } } },
  });
  const auto = campanhas.filter((c) => c.tipo === "AUTOMATICA");
  const pontuais = campanhas.filter((c) => c.tipo === "PONTUAL");
  const ativa = (rec: string) => auto.find((c) => c.recorrencia === rec)?.status === "ATIVA";

  return (
    <>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl">Campanhas</h1>
        <Link href="/admin/campanhas/nova" className="rounded-mi bg-mi-marrom px-4 py-2 text-sm text-white">
          + Nova campanha
        </Link>
      </div>

      <section className="mb-8">
        <h2 className="mb-2 text-lg">Automáticas</h2>
        <p className="mb-3 text-sm text-mi-texto/60">
          Ligam sozinhas nos gatilhos. Com aprovação: a lista fica pendente pra você conferir antes de enviar.
        </p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {PRESETS_AUTOMATICOS.map((p) => {
            const on = ativa(p.recorrencia);
            const camp = auto.find((c) => c.recorrencia === p.recorrencia);
            return (
              <div key={p.recorrencia} className="rounded-mi bg-mi-branco p-4 shadow-suave">
                <p className="font-corpo text-mi-marrom-escuro">{p.nome}</p>
                <p className="mt-1 line-clamp-2 text-xs text-mi-texto/60">{p.corpo}</p>
                <div className="mt-3 flex items-center gap-2">
                  {on ? (
                    <>
                      <span className="text-xs text-emerald-700">● Ativa</span>
                      {camp && (
                        <form action={alternarStatusAction.bind(null, camp.id, false)}>
                          <button className="text-xs text-mi-marrom underline">pausar</button>
                        </form>
                      )}
                      {camp && (
                        <Link href={`/admin/campanhas/${camp.id}`} className="text-xs text-mi-marrom underline">
                          ver
                        </Link>
                      )}
                    </>
                  ) : (
                    <form action={ativarPresetAction.bind(null, p.recorrencia)}>
                      <button className="rounded-mi border border-mi-marrom px-3 py-1 text-xs text-mi-marrom hover:bg-mi-marrom hover:text-white">
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
          <p className="rounded-mi bg-mi-branco p-6 text-center text-sm text-mi-texto/60 shadow-suave">
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
                  <p className="text-xs text-mi-texto/55">{c._count.envios} envio(s)</p>
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
