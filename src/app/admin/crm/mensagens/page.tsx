import Link from "next/link";
import { DateTime } from "luxon";
import { prisma } from "@/lib/prisma";
import { evolutionConfigured } from "@/lib/notify";
import { formatPhoneBR } from "@/lib/format";
import { REGUA_LABEL } from "@/lib/reguas";
import FilaMensagens, { type ItemFila } from "./FilaMensagens";

export const dynamic = "force-dynamic";

const fmt = (d: Date) =>
  DateTime.fromJSDate(d).setZone("America/Sao_Paulo").toFormat("dd/LL 'às' HH:mm");

/**
 * F4 — fila de aprovação de mensagens. Nenhuma mensagem sai sem a Mi editar
 * e mandar daqui. Sugestões vêm das réguas (cron diário ou botão); o ritmo
 * (intervalo por cliente, teto por dia) é configurado em /admin/crm/config.
 */
export default async function MensagensPage() {
  const [aguardando, historico] = await Promise.all([
    prisma.envioMensagem.findMany({
      where: { status: "aguardando" },
      include: { customer: { select: { id: true, name: true, phoneE164: true } } },
      orderBy: { createdAt: "asc" },
      take: 50,
    }),
    prisma.envioMensagem.findMany({
      where: { status: { in: ["enviado", "falha", "cancelado"] } },
      include: { customer: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 15,
    }),
  ]);

  const itens: ItemFila[] = aguardando.map((e) => ({
    id: e.id,
    clienteId: e.customer.id,
    clienteNome: e.customer.name,
    telefone: formatPhoneBR(e.customer.phoneE164),
    origem: REGUA_LABEL[e.kind] ?? e.kind,
    texto: e.texto ?? "",
    criadoEm: fmt(e.createdAt),
  }));

  return (
    <>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl">Mensagens</h1>
        <Link href="/admin/crm" className="text-sm text-mi-marrom-escuro hover:underline">
          ← CRM
        </Link>
      </div>
      <p className="mb-6 max-w-2xl text-sm text-mi-texto/80">
        Sugestões de mensagem esperando o seu toque: leia, deixe com a sua cara
        e envie — nada sai sem passar por você. O ritmo e a quantidade você
        ajusta nas{" "}
        <Link href="/admin/crm/config" className="underline">
          Configurações do CRM
        </Link>
        .
      </p>

      <FilaMensagens itens={itens} whatsappOk={evolutionConfigured()} />

      <section className="mt-10">
        <h2 className="mb-3 text-xl">Últimas tratadas</h2>
        {historico.length === 0 ? (
          <p className="rounded-mi bg-mi-branco p-4 text-sm text-mi-texto/80 shadow-suave">
            Nada por aqui ainda.
          </p>
        ) : (
          <div className="space-y-2">
            {historico.map((e) => (
              <div
                key={e.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-mi bg-mi-branco px-4 py-3 text-sm shadow-suave"
              >
                <span>
                  <strong>{e.customer.name}</strong> ·{" "}
                  {REGUA_LABEL[e.kind] ?? e.kind}
                </span>
                <span className="flex items-center gap-2">
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs ${
                      e.status === "enviado"
                        ? "bg-mi-sucesso/10 text-mi-sucesso-tinta"
                        : e.status === "falha"
                          ? "bg-mi-erro/10 text-mi-erro-tinta"
                          : "bg-mi-cinza text-mi-texto"
                    }`}
                  >
                    {e.status === "enviado"
                      ? "enviada"
                      : e.status === "falha"
                        ? "falhou"
                        : "descartada"}
                  </span>
                  <span className="text-xs text-mi-texto/80">
                    {fmt(e.enviadoEm ?? e.createdAt)}
                  </span>
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
