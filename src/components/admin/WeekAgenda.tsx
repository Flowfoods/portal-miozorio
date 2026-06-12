import Link from "next/link";
import { DateTime } from "luxon";
import type { Booking, Customer, Service } from "@prisma/client";
import { temAlergia } from "@/lib/anamnesis";

type WeekBooking = Booking & { customer: Customer; service: Service };

// Status que somem da grade (cancelados/no-show poluiriam a visão semanal).
const HIDDEN = new Set([
  "cancelled_by_client",
  "cancelled_by_business",
  "no_show",
]);

/**
 * Visão Semana da Agenda (M10.2): colunas sáb→sex (começa no fim de semana,
 * o forte da Mi). Cards compactos; toque leva à visão Dia com âncora no
 * agendamento (as ações vivem lá).
 */
export default function WeekAgenda({
  weekStartISO,
  bookings,
  tz,
}: {
  weekStartISO: string;
  bookings: WeekBooking[];
  tz: string;
}) {
  const weekStart = DateTime.fromISO(weekStartISO, { zone: tz });
  const days = Array.from({ length: 7 }, (_, i) => weekStart.plus({ days: i }));

  const byDay = new Map<string, WeekBooking[]>();
  for (const b of bookings) {
    if (HIDDEN.has(b.status)) continue;
    const key = DateTime.fromJSDate(b.startsAt).setZone(tz).toISODate() ?? "";
    (byDay.get(key) ?? byDay.set(key, []).get(key)!).push(b);
  }

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
      {days.map((d) => {
        const iso = d.toISODate() ?? "";
        const list = (byDay.get(iso) ?? []).sort(
          (a, b) => a.startsAt.getTime() - b.startsAt.getTime(),
        );
        const isToday = d.hasSame(DateTime.now().setZone(tz), "day");
        return (
          <div
            key={iso}
            className={`rounded-mi border p-2 ${
              isToday ? "border-mi-marrom bg-mi-bege/40" : "border-mi-cinza bg-mi-branco"
            }`}
          >
            <Link
              href={`/admin?data=${iso}`}
              className="mb-2 block border-b border-mi-cinza pb-1 text-xs"
            >
              <span className="font-medium capitalize text-mi-marrom-escuro">
                {d.setLocale("pt-BR").toFormat("ccc dd/LL")}
              </span>
            </Link>
            <div className="space-y-1.5">
              {list.length === 0 && (
                <p className="py-2 text-center text-[11px] text-mi-texto/40">—</p>
              )}
              {list.map((b) => {
                const t = DateTime.fromJSDate(b.startsAt).setZone(tz);
                const alergia = temAlergia(b.anamnesis);
                return (
                  <Link
                    key={b.id}
                    href={`/admin?data=${iso}#b-${b.id}`}
                    className="block rounded-[10px] bg-mi-bege/60 p-1.5 text-[11px] leading-tight transition-colors hover:bg-mi-cinza"
                  >
                    <span className="flex items-center justify-between gap-1">
                      <span className="font-medium text-mi-marrom-escuro">
                        {t.toFormat("HH:mm")}
                      </span>
                      <span className="flex items-center gap-0.5">
                        {b.location === "home" && <span title="Domicílio">🏠</span>}
                        {alergia && (
                          <span
                            title="Alergia registrada"
                            className="rounded bg-red-600 px-1 text-[9px] font-bold text-white"
                          >
                            ⚠
                          </span>
                        )}
                      </span>
                    </span>
                    <span className="block truncate text-mi-texto">
                      {b.customer.name.split(" ")[0]}
                    </span>
                    <span className="block truncate text-mi-texto/60">
                      {b.service.name}
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
