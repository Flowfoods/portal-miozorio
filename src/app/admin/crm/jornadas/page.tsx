import Link from "next/link";
import { prisma } from "@/lib/prisma";
import SubmitButton from "@/components/admin/SubmitButton";
import { adminToggleJornada, adminSeedJornadasPadrao } from "../../actions";

export const dynamic = "force-dynamic";

const GATILHO_LABEL: Record<string, string> = {
  boas_vindas: "Boas-vindas · 1º atendimento concluído",
  manutencao: "Manutenção · recompra após um tempo sem voltar",
  reativacao: "Reativação · segmento Em risco / Hibernando",
};

export default async function CrmJornadasPage() {
  const jornadas = await prisma.jornada.findMany({
    orderBy: { createdAt: "asc" },
    include: {
      etapas: { orderBy: { ordem: "asc" }, take: 1 },
      _count: { select: { envios: true } },
    },
  });

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl">Jornadas</h1>
        <Link href="/admin/crm" className="text-sm text-mi-marrom-escuro hover:underline">
          ← CRM
        </Link>
      </div>

      <div className="mb-5 rounded-mi bg-mi-bege/40 p-4 text-sm text-mi-texto/80">
        Jornadas só enviam para clientes que <strong>autorizaram</strong> mensagens
        no WhatsApp (opt-in na ficha) e enquanto estiverem <strong>ativas</strong>.
        Os textos são rascunhos — revise e aprove com a Mi antes de ativar.
      </div>

      {jornadas.length === 0 ? (
        <form action={adminSeedJornadasPadrao}>
          <p className="mb-3 text-sm text-mi-texto/80">
            Nenhuma jornada criada ainda. Crie as três padrão (todas desativadas).
          </p>
          <SubmitButton
            pendingLabel="Criando…"
            className="rounded-mi bg-mi-marrom-escuro px-4 py-2 text-sm text-white"
          >
            Criar jornadas padrão
          </SubmitButton>
        </form>
      ) : (
        <div className="space-y-3">
          {jornadas.map((j) => {
            const etapa = j.etapas[0];
            return (
              <div
                key={j.id}
                className="rounded-mi bg-mi-branco p-5 shadow-suave"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 font-titulo text-lg text-mi-marrom-escuro">
                      {j.nome}
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs ${
                          j.ativo
                            ? "bg-mi-sucesso/10 text-mi-sucesso-tinta"
                            : "bg-mi-cinza/50 text-mi-texto/80"
                        }`}
                      >
                        {j.ativo ? "Ativa" : "Desativada"}
                      </span>
                    </p>
                    <p className="mt-0.5 text-xs text-mi-texto/80">
                      {GATILHO_LABEL[j.gatilho] ?? j.gatilho} · {j._count.envios}{" "}
                      envio(s)
                    </p>
                  </div>
                  <form action={adminToggleJornada.bind(null, j.id, !j.ativo)}>
                    <button
                      className={`rounded-mi px-4 py-2 text-sm ${
                        j.ativo
                          ? "border border-mi-cinza text-mi-erro-tinta"
                          : "bg-mi-marrom-escuro text-white"
                      }`}
                    >
                      {j.ativo ? "Desativar" : "Ativar"}
                    </button>
                  </form>
                </div>
                {etapa?.template && (
                  <p className="mt-3 whitespace-pre-line rounded-mi bg-mi-bege/40 px-3 py-2 text-sm text-mi-texto/80">
                    {etapa.template}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
