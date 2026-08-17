import Link from "next/link";
import { DateTime } from "luxon";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";
import { formatPeriodoExtenso } from "@/lib/periods";
import { periodoDaRequest } from "@/lib/periods-server";
import PeriodSelector from "@/components/admin/PeriodSelector";
import { reenviarMensagemAction } from "./actions";

export const dynamic = "force-dynamic";

const STATUS: { key: string; label: string; tom: string }[] = [
  { key: "", label: "Todas", tom: "" },
  { key: "QUEUED", label: "Na fila", tom: "text-mi-alerta-tinta" },
  // "Enviada" só quer dizer que a Evolution aceitou a mensagem — não que ela
  // chegou no celular da cliente. Chamar isso de "Enviada" fazia a Mi decidir
  // sobre uma cliente com base numa certeza que o dado não tem.
  { key: "SENT", label: "Saiu daqui", tom: "text-mi-sucesso-tinta" },
  { key: "DELIVERED", label: "Chegou", tom: "text-mi-sucesso-tinta" },
  { key: "FAILED", label: "Falhas", tom: "text-mi-erro-tinta" },
  { key: "OPTED_OUT", label: "Pediu pra não receber", tom: "text-mi-texto/80" },
];

function statusInfo(s: string) {
  return STATUS.find((x) => x.key === s) ?? { label: s, tom: "text-mi-texto/80" };
}

export default async function MensagensPage({
  searchParams,
}: {
  searchParams: { status?: string; periodo?: string; de?: string; ate?: string };
}) {
  await requireAdmin();
  const { timezone: tz } = await getSettings();
  const pr = periodoDaRequest("mensagens", searchParams, {
    fallback: "ultimos30",
    zone: tz,
  });
  const status = searchParams.status && STATUS.some((s) => s.key === searchParams.status)
    ? searchParams.status
    : "";

  const where = {
    criadoEm: { gte: pr.period.from, lte: pr.period.to },
    ...(status ? { status } : {}),
  };
  const [msgs, contagens] = await Promise.all([
    prisma.whatsAppMessage.findMany({
      where,
      orderBy: { criadoEm: "desc" },
      take: 200,
      select: {
        id: true,
        telefone: true,
        tipo: true,
        templateKey: true,
        texto: true,
        status: true,
        tentativas: true,
        erro: true,
        criadoEm: true,
      },
    }),
    prisma.whatsAppMessage.groupBy({
      by: ["status"],
      where: { criadoEm: { gte: pr.period.from, lte: pr.period.to } },
      _count: { _all: true },
    }),
  ]);
  const total = contagens.reduce((s, c) => s + c._count._all, 0);

  const qs = (st: string) => {
    const p = new URLSearchParams();
    if (st) p.set("status", st);
    if (searchParams.periodo) p.set("periodo", searchParams.periodo);
    if (searchParams.de) p.set("de", searchParams.de);
    if (searchParams.ate) p.set("ate", searchParams.ate);
    const s = p.toString();
    return s ? `?${s}` : "";
  };

  return (
    <>
      <h1 className="mb-2 text-3xl">Mensagens</h1>
      <p className="mb-4 text-sm text-mi-texto/80">
        Tudo que o portal enviou pelo WhatsApp — com status e reenvio das que falharam.
      </p>

      <PeriodSelector
        modulo="mensagens"
        preset={pr.period.preset}
        deISO={pr.period.deISO}
        ateISO={pr.period.ateISO}
        extenso={formatPeriodoExtenso(pr.period, tz)}
        error={pr.error}
      />

      <div className="mb-4 flex flex-wrap gap-2">
        {STATUS.map((s) => {
          const n =
            s.key === ""
              ? total
              : contagens.find((c) => c.status === s.key)?._count._all ?? 0;
          const on = status === s.key;
          return (
            <Link
              key={s.key || "all"}
              href={`/admin/mensagens${qs(s.key)}`}
              className={`rounded-full px-3 py-1.5 text-sm ${
                on
                  ? "bg-mi-marrom-escuro text-white"
                  : "bg-mi-superficie-nav text-mi-marrom-escuro"
              }`}
            >
              {s.label} ({n})
            </Link>
          );
        })}
      </div>

      {msgs.length === 0 ? (
        <p className="rounded-mi bg-mi-branco p-6 text-center text-sm text-mi-texto/80 shadow-suave">
          Nenhuma mensagem nesse período 🤎 Tente ampliar as datas.
        </p>
      ) : (
        <ul className="divide-y divide-mi-cinza/60 rounded-mi bg-mi-branco shadow-suave">
          {msgs.map((m) => {
            const info = statusInfo(m.status);
            const quando = DateTime.fromJSDate(m.criadoEm)
              .setZone(tz)
              .setLocale("pt-BR")
              .toFormat("dd/MM HH:mm");
            return (
              <li key={m.id} className="px-4 py-3 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className={`font-corpo ${info.tom}`}>{info.label}</span>
                  <span className="text-xs text-mi-texto/80">
                    {m.tipo === "CAMPANHA" ? "Campanha" : "Transacional"} · {quando}
                  </span>
                </div>
                <p className="mt-1 truncate text-mi-texto/80">{m.texto}</p>
                <div className="mt-1 flex items-center justify-between gap-3">
                  <span className="text-xs text-mi-texto/80">
                    ***{m.telefone.slice(-4)}
                    {m.templateKey ? ` · ${m.templateKey}` : ""}
                    {m.tentativas > 0 ? ` · ${m.tentativas} tentativa(s)` : ""}
                  </span>
                  {(m.status === "FAILED" || m.status === "OPTED_OUT") && (
                    <form action={reenviarMensagemAction.bind(null, m.id)}>
                      <button className="rounded-mi border border-mi-marrom px-3 py-1 text-xs text-mi-marrom-escuro transition-colors hover:bg-mi-marrom-escuro hover:text-white">
                        Reenviar
                      </button>
                    </form>
                  )}
                </div>
                {m.erro && (
                  <p className="mt-1 text-xs text-mi-erro-tinta/70">{m.erro}</p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
