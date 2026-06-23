import Link from "next/link";
import { DateTime } from "luxon";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";
import { formatBRL } from "@/lib/format";
import { temAlergia } from "@/lib/anamnesis";
import { STATUS_LABEL, STATUS_STYLE } from "@/components/admin/bookingStatus";
import NovoAgendamento from "@/components/admin/NovoAgendamento";
import WeekAgenda from "@/components/admin/WeekAgenda";
import RescheduleForm from "@/components/admin/RescheduleForm";
import {
  adminConfirmBooking,
  adminCancelBooking,
  adminMarkNoShow,
  adminMarkCompleted,
  adminDeleteBookingPhoto,
} from "./actions";

export const dynamic = "force-dynamic";

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
  // Alergia: vale tanto a da anamnese do atendimento quanto a da ficha (M11).
  const alergiaFicha = (b.customer.allergies ?? "").trim();
  const alergia = temAlergia(b.anamnesis) || alergiaFicha.length > 0;
  return (
    <article
      id={`b-${b.id}`}
      className="scroll-mt-24 rounded-mi bg-mi-branco p-4 shadow-suave target:ring-2 target:ring-mi-marrom"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-medium">
            {starts.toFormat("HH:mm")}–{ends.toFormat("HH:mm")} ·{" "}
            {b.service.name}
          </p>
          <p className="text-sm text-mi-texto/80">
            <Link
              href={`/admin/clientes/${b.customerId}`}
              className="underline underline-offset-4"
            >
              {b.customer.name}
            </Link>{" "}
            · {b.customer.phoneE164} ·{" "}
            {b.location === "home" ? "domicílio" : "estúdio"} ·{" "}
            {formatBRL(b.priceCents)}
          </p>
          {alergia && (
            <p className="mt-1 text-xs font-medium text-red-800">
              ⚠ Alergia registrada
              {alergiaFicha && <> (ficha): {alergiaFicha}</>}
            </p>
          )}
          {b.customer.strikes > 0 && (
            <p className="text-xs text-red-800">
              ⚠ {b.customer.strikes} cancelamento(s) em cima da hora
            </p>
          )}
          <Anamnese data={b.anamnesis} />
          {b.photoKey && (
            <div className="mt-2 flex items-center gap-2">
              <a
                href={`/admin/media/${b.photoKey}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/admin/media/${b.photoKey}`}
                  alt="Foto de referência da cliente"
                  className="h-12 w-12 rounded-mi object-cover"
                />
              </a>
              <form action={adminDeleteBookingPhoto}>
                <input type="hidden" name="id" value={b.id} />
                <button className="text-xs text-mi-marrom underline-offset-2 hover:underline">
                  remover foto
                </button>
              </form>
            </div>
          )}
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
          <RescheduleForm
            bookingId={b.id}
            defaultDate={starts.toISODate() ?? ""}
          />
        </div>
      )}
    </article>
  );
}

// Sáb→sex: começa o quadro no sábado da semana que contém `day` (o forte da Mi).
function weekStartSaturday(day: DateTime): DateTime {
  const offset = (day.weekday - 6 + 7) % 7; // sáb(6)=0, dom(7)=1, seg(1)=2…
  return day.minus({ days: offset }).startOf("day");
}

export default async function AdminAgendaPage({
  searchParams,
}: {
  searchParams: { data?: string; vista?: string };
}) {
  const settings = await getSettings();
  const tz = settings.timezone;
  const today = DateTime.now().setZone(tz).startOf("day");
  const isWeek = searchParams.vista === "semana";

  const requested = searchParams.data
    ? DateTime.fromISO(searchParams.data, { zone: tz }).startOf("day")
    : today;
  const day = requested.isValid ? requested : today;

  const weekStart = weekStartSaturday(day);
  const weekEnd = weekStart.plus({ days: 7 });

  const [bookings, pendingUpcoming, confirmedWeek, services, weekBookings] =
    await Promise.all([
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
      prisma.service.findMany({
        where: { active: true },
        select: {
          id: true,
          name: true,
          durationMin: true,
          priceCents: true,
          priceHomeCents: true,
          bookableOnline: true,
          isCourse: true,
        },
        orderBy: [{ bookableOnline: "desc" }, { name: "asc" }],
      }),
      isWeek
        ? queryDay(weekStart.toJSDate(), weekEnd.toJSDate())
        : Promise.resolve([]),
    ]);

  const fmtDay = day.setLocale("pt-BR").toFormat("cccc, dd 'de' LLLL");
  const fmtWeek = `${weekStart.toFormat("dd/LL")} a ${weekEnd
    .minus({ days: 1 })
    .toFormat("dd/LL")}`;

  // Preserva a vista atual ao navegar de dia/semana.
  const withView = (iso: string) =>
    isWeek ? `/admin?vista=semana&data=${iso}` : `/admin?data=${iso}`;

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl">Agenda</h1>
        <p className="text-sm text-mi-texto/70">
          {confirmedWeek} confirmado(s) nos próximos 7 dias ·{" "}
          {pendingUpcoming.length} pendente(s)
        </p>
      </div>

      {/* Novo agendamento (encaixe manual M10.1) + toggle Dia/Semana */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <NovoAgendamento
          services={services}
          defaultDate={day.toISODate() ?? today.toISODate() ?? ""}
        />
        <div className="inline-flex rounded-mi bg-mi-cinza p-1 text-sm">
          <Link
            href={`/admin?data=${day.toISODate()}`}
            className={`min-h-[36px] rounded-[10px] px-4 leading-9 ${
              !isWeek ? "bg-mi-branco text-mi-marrom-escuro shadow-suave" : "text-mi-marrom"
            }`}
          >
            Dia
          </Link>
          <Link
            href={`/admin?vista=semana&data=${day.toISODate()}`}
            className={`min-h-[36px] rounded-[10px] px-4 leading-9 ${
              isWeek ? "bg-mi-branco text-mi-marrom-escuro shadow-suave" : "text-mi-marrom"
            }`}
          >
            Semana
          </Link>
        </div>
      </div>

      {isWeek ? (
        <section>
          <div className="mb-4 flex items-center gap-3">
            <Link
              className="rounded-mi bg-mi-branco px-3 py-1.5 text-sm shadow-suave"
              href={withView(weekStart.minus({ days: 7 }).toISODate() ?? "")}
            >
              ← semana anterior
            </Link>
            <span className="font-titulo text-lg">{fmtWeek}</span>
            <Link
              className="rounded-mi bg-mi-branco px-3 py-1.5 text-sm shadow-suave"
              href={withView(weekStart.plus({ days: 7 }).toISODate() ?? "")}
            >
              próxima →
            </Link>
          </div>
          <WeekAgenda
            weekStartISO={weekStart.toISODate() ?? ""}
            bookings={weekBookings}
            tz={tz}
          />
        </section>
      ) : (
        <DayView
          day={day}
          today={today}
          tz={tz}
          fmtDay={fmtDay}
          bookings={bookings}
          pendingUpcoming={pendingUpcoming}
        />
      )}
    </>
  );
}

function DayView({
  day,
  today,
  tz,
  fmtDay,
  bookings,
  pendingUpcoming,
}: {
  day: DateTime;
  today: DateTime;
  tz: string;
  fmtDay: string;
  bookings: BookingWithRels[];
  pendingUpcoming: BookingWithRels[];
}) {
  return (
    <>
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
