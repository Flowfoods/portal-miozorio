import Link from "next/link";
import { DateTime } from "luxon";
import type { BookingStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";
import { formatBRL } from "@/lib/format";
import AdminNav from "@/components/admin/AdminNav";
import {
  adminConfirmBooking,
  adminCancelBooking,
  adminMarkNoShow,
  adminMarkCompleted,
} from "./actions";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<BookingStatus, string> = {
  pending: "Pendente",
  confirmed: "Confirmado",
  completed: "Concluído",
  cancelled_by_client: "Cancelado (cliente)",
  cancelled_by_business: "Cancelado (Mi)",
  no_show: "Não compareceu",
};

const STATUS_STYLE: Record<BookingStatus, string> = {
  pending: "bg-amber-100 text-amber-900",
  confirmed: "bg-emerald-100 text-emerald-900",
  completed: "bg-mi-cinza text-mi-texto",
  cancelled_by_client: "bg-red-50 text-red-800",
  cancelled_by_business: "bg-red-50 text-red-800",
  no_show: "bg-red-100 text-red-900",
};

type BookingWithRels = Awaited<ReturnType<typeof queryDay>>[number];

function queryDay(dayStart: Date, dayEnd: Date) {
  return prisma.booking.findMany({
    where: { startsAt: { gte: dayStart, lt: dayEnd } },
    include: { customer: true, service: true },
    orderBy: { startsAt: "asc" },
  });
}

function Anamnese({ data }: { data: unknown }) {
  if (!data || typeof data !== "object") return null;
  const a = data as Record<string, unknown>;
  const rows = [
    ["Alergia", a.alergia],
    ["Referência", a.referencia],
    ["Ocasião", a.ocasiao],
  ].filter(([, v]) => typeof v === "string" && v.trim());
  if (!rows.length) return null;
  return (
    <dl className="mt-2 space-y-0.5 text-xs text-mi-texto/70">
      {rows.map(([k, v]) => (
        <div key={String(k)}>
          <dt className="inline font-medium">{String(k)}: </dt>
          <dd className="inline">{String(v)}</dd>
        </div>
      ))}
    </dl>
  );
}

function BookingCard({ b, tz }: { b: BookingWithRels; tz: string }) {
  const starts = DateTime.fromJSDate(b.startsAt).setZone(tz);
  const ends = DateTime.fromJSDate(b.endsAt).setZone(tz);
  const actionable = b.status === "pending" || b.status === "confirmed";
  return (
    <article className="rounded-mi bg-mi-branco p-4 shadow-suave">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-medium">
            {starts.toFormat("HH:mm")}–{ends.toFormat("HH:mm")} ·{" "}
            {b.service.name}
          </p>
          <p className="text-sm text-mi-texto/80">
            {b.customer.name} · {b.customer.phoneE164} ·{" "}
            {b.location === "home" ? "domicílio" : "estúdio"} ·{" "}
            {formatBRL(b.priceCents)}
          </p>
          {b.customer.strikes > 0 && (
            <p className="text-xs text-red-800">
              ⚠ {b.customer.strikes} cancelamento(s) em cima da hora
            </p>
          )}
          <Anamnese data={b.anamnesis} />
        </div>
        <span
          className={`rounded-full px-3 py-1 text-xs ${STATUS_STYLE[b.status]}`}
        >
          {STATUS_LABEL[b.status]}
        </span>
      </div>
      {actionable && (
        <div className="mt-3 flex flex-wrap gap-2">
          {b.status === "pending" && (
            <form action={adminConfirmBooking.bind(null, b.id)}>
              <button className="rounded-mi bg-mi-marrom px-3 py-1.5 text-sm text-white">
                Confirmar
              </button>
            </form>
          )}
          {b.status === "confirmed" && (
            <form action={adminMarkCompleted.bind(null, b.id)}>
              <button className="rounded-mi bg-mi-marrom px-3 py-1.5 text-sm text-white">
                Concluir
              </button>
            </form>
          )}
          <form action={adminMarkNoShow.bind(null, b.id)}>
            <button className="rounded-mi border border-mi-cinza px-3 py-1.5 text-sm">
              Não veio
            </button>
          </form>
          <form action={adminCancelBooking.bind(null, b.id)}>
            <button className="rounded-mi border border-mi-cinza px-3 py-1.5 text-sm text-red-800">
              Cancelar
            </button>
          </form>
        </div>
      )}
    </article>
  );
}

export default async function AdminAgendaPage({
  searchParams,
}: {
  searchParams: { data?: string };
}) {
  const settings = await getSettings();
  const tz = settings.timezone;
  const today = DateTime.now().setZone(tz).startOf("day");

  const requested = searchParams.data
    ? DateTime.fromISO(searchParams.data, { zone: tz }).startOf("day")
    : today;
  const day = requested.isValid ? requested : today;

  const [bookings, pendingUpcoming, confirmedWeek] = await Promise.all([
    queryDay(day.toJSDate(), day.plus({ days: 1 }).toJSDate()),
    prisma.booking.findMany({
      where: { status: "pending", startsAt: { gte: today.toJSDate() } },
      include: { customer: true, service: true },
      orderBy: { startsAt: "asc" },
      take: 20,
    }),
    prisma.booking.count({
      where: {
        status: "confirmed",
        startsAt: {
          gte: today.toJSDate(),
          lt: today.plus({ days: 7 }).toJSDate(),
        },
      },
    }),
  ]);

  const fmtDay = day.setLocale("pt-BR").toFormat("cccc, dd 'de' LLLL");

  return (
    <>
      <AdminNav />
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl">Agenda</h1>
        <p className="text-sm text-mi-texto/70">
          {confirmedWeek} confirmado(s) nos próximos 7 dias ·{" "}
          {pendingUpcoming.length} pendente(s)
        </p>
      </div>

      <div className="mb-6 flex items-center gap-3">
        <Link
          className="rounded-mi bg-mi-branco px-3 py-1.5 text-sm shadow-suave"
          href={`/admin?data=${day.minus({ days: 1 }).toISODate()}`}
        >
          ← anterior
        </Link>
        <span className="font-titulo text-lg capitalize">{fmtDay}</span>
        <Link
          className="rounded-mi bg-mi-branco px-3 py-1.5 text-sm shadow-suave"
          href={`/admin?data=${day.plus({ days: 1 }).toISODate()}`}
        >
          próximo →
        </Link>
        {!day.equals(today) && (
          <Link className="text-sm text-mi-marrom underline" href="/admin">
            hoje
          </Link>
        )}
      </div>

      <section className="space-y-3">
        {bookings.length === 0 && (
          <p className="rounded-mi bg-mi-branco p-6 text-sm text-mi-texto/60 shadow-suave">
            Nenhum agendamento neste dia.
          </p>
        )}
        {bookings.map((b) => (
          <BookingCard key={b.id} b={b} tz={tz} />
        ))}
      </section>

      {pendingUpcoming.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-3 text-xl">Aguardando confirmação</h2>
          <div className="space-y-3">
            {pendingUpcoming.map((b) => (
              <BookingCard key={b.id} b={b} tz={tz} />
            ))}
          </div>
        </section>
      )}
    </>
  );
}
