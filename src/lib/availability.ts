import { DateTime } from "luxon";
import { prisma } from "./prisma";
import { getSettings } from "./settings";
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

  const hoursTable = service.isCourse
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
