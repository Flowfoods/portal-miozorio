import Link from "next/link";
import { DateTime } from "luxon";
import type { Booking, Customer, Service } from "@prisma/client";
import { formatBRL } from "@/lib/format";
import StatusPill from "@/components/ui/StatusPill";

type Row = Booking & { customer: Customer; service: Service };

/**
 * Visão de PERÍODO da Agenda (F2): agrupamento por dia com totais do intervalo
 * (atendimentos, receita estimada, cancelamentos, faltas). Cada linha leva à
 * visão diária com âncora — as ações continuam lá (nada de duplicar botões).
 * Receita estimada = soma dos valores de confirmados + concluídos (regras de
 * status do booking-engine preservadas na exibição).
 */
export default function AgendaPeriodo({
  bookings,
  tz,
}: {
  bookings: Row[];
  tz: string;
}) {
  const ativos = bookings.filter(
    (b) => b.status === "confirmed" || b.status === "completed",
  );
  const receitaCents = ativos.reduce((s, b) => s + b.priceCents, 0);
  const cancelados = bookings.filter(
    (b) =>
      b.status === "cancelled_by_client" || b.status === "cancelled_by_business",
  ).length;
  const faltas = bookings.filter((b) => b.status === "no_show").length;

  const porDia = new Map<string, Row[]>();
  for (const b of bookings) {
    const key = DateTime.fromJSDate(b.startsAt).setZone(tz).toISODate() ?? "";
    (porDia.get(key) ?? porDia.set(key, []).get(key)!).push(b);
  }
  const dias = Array.from(porDia.keys()).sort();

  return (
    <section>
      {/* Totais do período */}
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Total titulo="Atendimentos" valor={String(ativos.length)} sub="confirmados + concluídos" />
        <Total titulo="Receita estimada" valor={formatBRL(receitaCents)} sub="do período" />
        <Total titulo="Cancelamentos" valor={String(cancelados)} sub="no período" />
        <Total titulo="Faltas" valor={String(faltas)} sub="no-show" />
      </div>

      {dias.length === 0 && (
        <p className="rounded-mi bg-mi-superficie-elevada p-8 text-center font-corpo text-sm text-mi-texto/80 shadow-suave">
          Nenhum registro nesse período 🤎 Tente ampliar as datas.
        </p>
      )}

      <div className="space-y-5">
        {dias.map((iso) => {
          const doDia = porDia.get(iso)!;
          const d = DateTime.fromISO(iso, { zone: tz }).setLocale("pt-BR");
          return (
            <div key={iso}>
              <Link
                href={`/admin?data=${iso}`}
                className="mb-2 block font-titulo text-lg capitalize text-mi-marrom-escuro underline-offset-4 hover:underline"
              >
                {d.toFormat("cccc, dd 'de' LLLL")}
                <span className="ml-2 font-corpo text-xs normal-case text-mi-texto/80">
                  {doDia.length} atendimento(s)
                </span>
              </Link>
              <ul className="space-y-1.5">
                {doDia.map((b) => (
                  <li key={b.id}>
                    <Link
                      href={`/admin?data=${iso}#b-${b.id}`}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-mi bg-mi-superficie-elevada p-3 text-sm shadow-suave transition-colors hover:bg-mi-bege/40"
                    >
                      <span className="min-w-0">
                        <span className="font-medium">
                          {DateTime.fromJSDate(b.startsAt).setZone(tz).toFormat("HH:mm")}
                        </span>{" "}
                        · {b.customer.name.split(" ")[0]} · {b.service.name} ·{" "}
                        {formatBRL(b.priceCents)}
                      </span>
                      <StatusPill status={b.status} className="shrink-0" />
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function Total({ titulo, valor, sub }: { titulo: string; valor: string; sub: string }) {
  return (
    <div className="rounded-mi bg-mi-superficie-elevada p-4 shadow-suave">
      <p className="font-corpo text-xs uppercase tracking-wide text-mi-texto/80">
        {titulo}
      </p>
      <p className="mt-1 font-titulo text-2xl text-mi-marrom-escuro">{valor}</p>
      <p className="font-corpo text-xs text-mi-texto/80">{sub}</p>
    </div>
  );
}
