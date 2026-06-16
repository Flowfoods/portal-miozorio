import { DateTime } from "luxon";
import { prisma } from "./prisma";
import { getSettings, type WeeklyHours } from "./settings";
import {
  generateSlots,
  slotsToHHmm,
  busyFromBookings,
  type Range,
} from "./slots";

const WEEKDAY: Record<number, string> = {
  1: "mon",
  2: "tue",
  3: "wed",
  4: "thu",
  5: "fri",
  6: "sat",
  7: "sun",
};

/**
 * M9 — monta o WeeklyHours de um serviço a partir das linhas de
 * service_availability. Lista vazia → {} (o chamador cai no working_hours
 * global). Função pura, testável.
 */
export function buildServiceHours(
  rows: { weekday: number; startTime: string; endTime: string }[],
): WeeklyHours {
  const wh: WeeklyHours = {};
  for (const r of rows) {
    const key = WEEKDAY[r.weekday];
    if (!key) continue;
    (wh[key] ??= []).push([r.startTime, r.endTime]);
  }
  for (const k of Object.keys(wh)) {
    wh[k]!.sort((a, b) => a[0].localeCompare(b[0]));
  }
  return wh;
}

/**
 * Disponibilidade de um serviço num dia: monta os ocupados a partir do banco
 * (bookings vivos + bloqueios) e roda o motor de slots. Retorna ["09:00",...].
 */
export async function getAvailability(
  serviceId: string,
  dateISO: string,
): Promise<string[]> {
  const settings = await getSettings();
  const service = await prisma.service.findUnique({ where: { id: serviceId } });

  // Serviço inexistente / inativo / não-agendável (noiva/debutante — R1) → vazio.
  if (!service || !service.active || !service.bookableOnline) return [];

  const tz = settings.timezone;
  const day = DateTime.fromISO(dateISO, { zone: tz });
  if (!day.isValid) return [];

  // M9 — disponibilidade própria do serviço tem prioridade; sem ela, cai no
  // working_hours global (social) ou no de cursos.
  const availRows = await prisma.serviceAvailability.findMany({
    where: { serviceId },
    select: { weekday: true, startTime: true, endTime: true },
  });
  const hoursTable = availRows.length
    ? buildServiceHours(availRows)
    : service.isCourse
      ? settings.courseWorkingHours
      : settings.workingHours;
  const workingHours = hoursTable[WEEKDAY[day.weekday] ?? ""] ?? [];
  if (workingHours.length === 0) return [];

  const dayStart = day.startOf("day").toJSDate();
  const dayEnd = day.endOf("day").toJSDate();
  const now = DateTime.now().setZone(tz);

  const bookings = await prisma.booking.findMany({
    where: {
      startsAt: { gte: dayStart, lte: dayEnd },
      OR: [
        { status: "confirmed" },
        { status: "pending", holdExpiresAt: { gt: new Date() } },
      ],
    },
    select: { startsAt: true, endsAt: true, status: true, holdExpiresAt: true },
  });

  const blocks = await prisma.scheduleBlock.findMany({
    where: { startsAt: { lt: dayEnd }, endsAt: { gt: dayStart } },
    select: { startsAt: true, endsAt: true },
  });

  const busy: Range[] = [
    ...busyFromBookings(
      bookings.map((b) => ({
        startsAt: DateTime.fromJSDate(b.startsAt).setZone(tz),
        endsAt: DateTime.fromJSDate(b.endsAt).setZone(tz),
        status: b.status as "pending" | "confirmed",
        holdExpiresAt: b.holdExpiresAt
          ? DateTime.fromJSDate(b.holdExpiresAt).setZone(tz)
          : null,
      })),
      now,
    ),
    ...blocks.map((bl) => ({
      start: DateTime.fromJSDate(bl.startsAt).setZone(tz),
      end: DateTime.fromJSDate(bl.endsAt).setZone(tz),
    })),
  ];

  const slots = generateSlots({
    date: dateISO,
    tz,
    workingHours,
    durationMin: service.durationMin,
    bufferMin: service.bufferMin,
    stepMin: settings.slotStepMin,
    busy,
    minLeadHours: settings.minLeadHours,
    maxLeadDays: settings.maxLeadDays,
    now,
  });

  return slotsToHHmm(slots);
}
