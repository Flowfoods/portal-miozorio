import Link from "next/link";
import { DateTime } from "luxon";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";
import { formatBRL } from "@/lib/format";
import { temAlergia } from "@/lib/anamnesis";
import { aguardandoValidacaoTamanho } from "@/lib/variantes";
import StatusPill from "@/components/ui/StatusPill";
import { historiaDoAgendamento } from "@/lib/booking-historia";
import NovoAgendamento from "@/components/admin/NovoAgendamento";
import PainelHoje from "@/components/admin/PainelHoje";
import WeekAgenda from "@/components/admin/WeekAgenda";
import RescheduleForm from "@/components/admin/RescheduleForm";
import ConfirmForm from "@/components/admin/ConfirmForm";
import PeriodSelector from "@/components/admin/PeriodSelector";
import AgendaPeriodo from "@/components/admin/AgendaPeriodo";
import { periodoDaRequest } from "@/lib/periods-server";
import { buildPeriod, formatPeriodoExtenso } from "@/lib/periods";
import {
  adminConfirmBooking,
  adminCancelBooking,
  adminReativarBooking,
  adminMarkNoShow,
  adminMarkCompleted,
  adminValidarTamanho,
  adminDeleteBookingPhoto,
} from "./actions";
import { exigirSessaoDoPainel } from "@/lib/auth-painel";

export const dynamic = "force-dynamic";

type BookingWithRels = Awaited<ReturnType<typeof queryDay>>[number];

/**
 * Include único do cartão de agendamento. Estava copiado em duas queries (a do
 * dia e a do período) com um comentário "mesmo include do dia" segurando a
 * consistência na mão — e foi exatamente por aí que a A3 quebrou o build ao
 * adicionar um campo em só uma delas. Uma fonte, as duas leem.
 */
const BOOKING_CARD_INCLUDE = {
  customer: true,
  // A3 — tamanhos do serviço para o select de "Ajustar tamanho".
  service: {
    include: {
      variants: { where: { active: true }, orderBy: { sort: "asc" } },
    },
  },
  variant: true,
  // Último evento: é ele que diz QUEM fez o quê. Sem isto a tela mostrava
  // "Cancelado (Mi)" para reserva encerrada pelo sistema.
  events: { orderBy: { createdAt: "desc" }, take: 1 },
} satisfies Prisma.BookingInclude;

function queryDay(dayStart: Date, dayEnd: Date) {
  return prisma.booking.findMany({
    where: { startsAt: { gte: dayStart, lt: dayEnd } },
    include: BOOKING_CARD_INCLUDE,
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
    <dl className="mt-2 space-y-0.5 text-xs text-mi-texto/80">
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
  // A5 — cancelado/expirado com o horário ainda no futuro pode voltar.
  const reativavel =
    (b.status === "cancelled_by_business" ||
      b.status === "cancelled_by_client") &&
    b.startsAt > new Date();
  // Primeiro nome na confirmação: "Cancelar o horário da Ana?" evita o clique
  // no cartão errado muito melhor que "Tem certeza?".
  const primeiroNome = b.customer.name.trim().split(/\s+/)[0] || "essa cliente";
  // Quem fez o quê, tirado do último evento — não do status cru.
  const historia = historiaDoAgendamento(b.events[0]);
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
            <p className="mt-1 text-xs font-medium text-mi-erro-tinta">
              ⚠ Alergia registrada
              {alergiaFicha && <> (ficha): {alergiaFicha}</>}
            </p>
          )}
          {b.customer.strikes > 0 && (
            <p className="text-xs text-mi-erro-tinta">
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
                <button className="text-xs text-mi-marrom-escuro underline-offset-2 hover:underline">
                  remover foto
                </button>
              </form>
            </div>
          )}
        </div>
        <StatusPill status={b.status} cancelledBy={b.cancelledBy} />
      </div>
      {historia && (
        <p className="mt-1 font-corpo text-xs text-mi-texto/80">{historia}</p>
      )}

      {/* A3 — a cliente escolheu um tamanho e mandou foto. Enquanto você não
          confere, o valor é o que ela escolheu. Não é um status novo: o
          agendamento segue `pending`, protegido pela trava anti-double-booking
          (um status novo cairia fora do WHERE da constraint). */}
      {b.variantId && (
        <div className="mt-3 rounded-mi border border-mi-alerta/40 bg-mi-alerta/5 p-3">
          <p className="font-corpo text-xs font-medium text-mi-alerta-tinta">
            {aguardandoValidacaoTamanho(b)
              ? "📸 Confira o tamanho e aprove"
              : "✓ Tamanho conferido"}
            {b.variant ? ` — ${b.variant.nome}` : ""}
          </p>
          {b.sizeAdjustReason && (
            <p className="mt-1 font-corpo text-xs text-mi-texto/80">
              Ajuste: {b.sizeAdjustReason}
            </p>
          )}
          {aguardandoValidacaoTamanho(b) && (
            <div className="mt-2 flex flex-wrap items-end gap-2">
              <form action={adminValidarTamanho}>
                <input type="hidden" name="id" value={b.id} />
                <button className="min-h-[44px] rounded-mi bg-mi-marrom-escuro px-3 py-1.5 text-sm text-white">
                  Aprovar tamanho
                </button>
              </form>
              <form
                action={adminValidarTamanho}
                className="flex flex-wrap items-end gap-2"
              >
                <input type="hidden" name="id" value={b.id} />
                <label className="text-xs">
                  Ajustar para
                  <select
                    name="variantId"
                    defaultValue={b.variantId}
                    className="input-mi mt-1 !py-2 text-sm"
                  >
                    {b.service.variants.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.nome}
                      </option>
                    ))}
                  </select>
                </label>
                <input
                  name="motivo"
                  placeholder="motivo (opcional)"
                  className="input-mi !py-2 text-sm sm:w-48"
                />
                <button className="min-h-[44px] rounded-mi border border-mi-cinza px-3 py-1.5 text-sm">
                  Ajustar
                </button>
              </form>
            </div>
          )}
        </div>
      )}
      {actionable && (
        <div className="mt-3 flex flex-wrap gap-2">
          {b.status === "pending" && (
            <form action={adminConfirmBooking.bind(null, b.id)}>
              <button className="rounded-mi bg-mi-marrom-escuro px-3 py-1.5 text-sm text-white">
                Confirmar
              </button>
            </form>
          )}
          {b.status === "confirmed" && (
            <form action={adminMarkCompleted.bind(null, b.id)}>
              <button className="rounded-mi bg-mi-marrom-escuro px-3 py-1.5 text-sm text-white">
                Concluir
              </button>
            </form>
          )}
          {/* Ficavam a 32px, sem confirmação, colados nos botões do dia a dia.
              O ConfirmForm já existia com a docstring "dedo escorrega fácil no
              celular", mas guardava só a exclusão de uma foto.
              "Não veio" segue irreversível (conta strike). "Cancelar" deixou de
              ser, com o Reativar do A5 — e a confirmação diz isso. */}
          <ConfirmForm
            action={adminMarkNoShow.bind(null, b.id)}
            message={`Marcar que ${primeiroNome} não veio? Isso conta um strike para ela e não dá para desfazer.`}
          >
            <button className="min-h-[44px] rounded-mi border border-mi-cinza px-3 py-1.5 text-sm">
              Não veio
            </button>
          </ConfirmForm>
          {/* A5: deixou de ser irreversível — existe "Reativar" agora. Manter
              o aviso antigo faria a Mi evitar o botão por medo. */}
          <ConfirmForm
            action={adminCancelBooking.bind(null, b.id)}
            message={`Cancelar o horário de ${primeiroNome}? Se precisar, dá para reativar depois — desde que o horário siga livre.`}
          >
            <button className="min-h-[44px] rounded-mi border border-mi-cinza px-3 py-1.5 text-sm text-mi-erro-tinta">
              Cancelar
            </button>
          </ConfirmForm>
          <RescheduleForm
            bookingId={b.id}
            defaultDate={starts.toISODate() ?? ""}
          />
        </div>
      )}
      {/* A5 — o caminho de volta. Só aparece enquanto o horário ainda é futuro;
          a colisão real é revalidada no backend (a trava do banco é soberana). */}
      {reativavel && (
        <div className="mt-3">
          <form action={adminReativarBooking.bind(null, b.id)}>
            <button className="min-h-[44px] rounded-mi bg-mi-marrom-escuro px-3 py-1.5 text-sm text-white">
              Reativar e confirmar
            </button>
          </form>
          <p className="mt-1 font-corpo text-xs text-mi-texto/80">
            Traz {primeiroNome} de volta para esse horário, se ele ainda estiver
            livre.
          </p>
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
  searchParams: {
    data?: string;
    vista?: string;
    periodo?: string;
    de?: string;
    ate?: string;
  };
}) {
  await exigirSessaoDoPainel();
  const settings = await getSettings();
  const tz = settings.timezone;
  const today = DateTime.now().setZone(tz).startOf("day");
  const isWeek = searchParams.vista === "semana";

  // Navegação fina (?data=/?vista=) SEMPRE vence o período — preserva todos os
  // deep links existentes (/admin?data=...#b-id) e os botões ←/→ do dia.
  const modoDia = Boolean(searchParams.data || searchParams.vista);
  const pr = modoDia
    ? null
    : periodoDaRequest("agenda", searchParams, { fallback: "hoje", zone: tz });
  const periodoAtivo = pr && pr.period.preset !== "hoje" ? pr.period : null;

  const requested = searchParams.data
    ? DateTime.fromISO(searchParams.data, { zone: tz }).startOf("day")
    : today;
  const day = requested.isValid ? requested : today;

  // Props do seletor: em modo dia/hoje ele mostra o dia navegado por extenso.
  const selDia = buildPeriod("hoje", day.toISODate() ?? "", day.toISODate() ?? "", tz);
  const sel = periodoAtivo ?? selDia;

  const weekStart = weekStartSaturday(day);
  const weekEnd = weekStart.plus({ days: 7 });

  const [bookings, pendingUpcoming, confirmedWeek, services, weekBookings] =
    await Promise.all([
      queryDay(day.toJSDate(), day.plus({ days: 1 }).toJSDate()),
      prisma.booking.findMany({
        where: { status: "pending", startsAt: { gte: today.toJSDate() } },
        include: BOOKING_CARD_INCLUDE,
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
        where: { active: true, archivedAt: null },
        select: {
          id: true,
          name: true,
          durationMin: true,
          category: true,
          priceCents: true,
          priceHomeCents: true,
          bookableOnline: true,
          isCourse: true,
        },
        // A6 — agrupa por categoria e ordena por nome, para a Mi achar o
        // serviço onde espera. `bookableOnline` primeiro mantinha noiva e
        // debutante jogadas no fim, longe do resto da categoria delas.
        orderBy: [{ category: "asc" }, { name: "asc" }],
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

  // Visão de período (F2): agrupamento por dia no intervalo selecionado.
  const periodoBookings = periodoAtivo
    ? await prisma.booking.findMany({
        where: { startsAt: { gte: periodoAtivo.from, lte: periodoAtivo.to } },
        include: BOOKING_CARD_INCLUDE,
        orderBy: { startsAt: "asc" },
      })
    : [];

  return (
    <>
      <PainelHoje />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl">Agenda</h1>
        <p className="text-sm text-mi-texto/80">
          {confirmedWeek} confirmado(s) nos próximos 7 dias ·{" "}
          {pendingUpcoming.length} pendente(s)
        </p>
      </div>

      <PeriodSelector
        modulo="agenda"
        preset={sel.preset}
        deISO={sel.deISO}
        ateISO={sel.ateISO}
        extenso={formatPeriodoExtenso(sel, tz)}
        error={pr?.error}
      />

      {periodoAtivo ? (
        <AgendaPeriodo bookings={periodoBookings} tz={tz} />
      ) : (
        <AgendaDiaSemana />
      )}
    </>
  );

  // Visão dia/semana original (preset "Hoje" — comportamento preservado; os
  // botões ←/→ seguem como navegação fina dentro do preset).
  function AgendaDiaSemana() {
    return (
    <>
      {/* Novo agendamento (encaixe manual M10.1) + toggle Dia/Semana */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <NovoAgendamento
          services={services}
          defaultDate={day.toISODate() ?? today.toISODate() ?? ""}
        />
        <div className="inline-flex rounded-mi bg-mi-cinza p-1 text-sm">
          <Link
            href={`/admin?data=${day.toISODate()}`}
            className={`min-h-[44px] rounded-[10px] px-4 leading-9 ${
              !isWeek ? "bg-mi-branco text-mi-marrom-escuro shadow-suave" : "text-mi-marrom-800"
            }`}
          >
            Dia
          </Link>
          <Link
            href={`/admin?vista=semana&data=${day.toISODate()}`}
            className={`min-h-[44px] rounded-[10px] px-4 leading-9 ${
              isWeek ? "bg-mi-branco text-mi-marrom-escuro shadow-suave" : "text-mi-marrom-800"
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
          <Link className="text-sm text-mi-marrom-escuro underline" href="/admin">
            hoje
          </Link>
        )}
      </div>

      <section className="space-y-3">
        {bookings.length === 0 && (
          <p className="rounded-mi bg-mi-branco p-6 text-sm text-mi-texto/80 shadow-suave">
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
