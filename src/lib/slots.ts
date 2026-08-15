import { DateTime, Interval } from "luxon";

/** Intervalo ocupado (booking com buffer, ou bloqueio de agenda). */
export type Range = { start: DateTime; end: DateTime };

export interface GenerateSlotsOptions {
  /** Dia consultado, ISO "YYYY-MM-DD", interpretado na timezone do negócio. */
  date: string;
  /** Timezone do negócio, ex. "America/Sao_Paulo" (R4). */
  tz: string;
  /** Janelas de funcionamento do dia, ex. [["09:00","19:00"]]. */
  workingHours: [string, string][];
  durationMin: number;
  bufferMin: number;
  /** Granularidade da varredura (30 = grade; duration+buffer = agenda encaixada). */
  stepMin: number;
  /** Ocupados: bookings vivos (starts..ends já com buffer) + bloqueios. */
  busy: Range[];
  minLeadHours: number;
  maxLeadDays: number;
  /** Relógio injetável (testes). Default: agora na tz. */
  now?: DateTime;
}

function toHM(s: string): {
  hour: number;
  minute: number;
  second: number;
  millisecond: number;
} {
  const parts = s.split(":");
  return {
    hour: Number(parts[0] ?? 0),
    minute: Number(parts[1] ?? 0),
    second: 0,
    millisecond: 0,
  };
}

/**
 * Gera os horários livres de um dia, calculados on-the-fly (nunca pré-gerados).
 * Retorna os inícios de slot como DateTime na timezone do negócio.
 * Ref.: booking-engine/slot-algorithm.md.
 */
export function generateSlots(opts: GenerateSlotsOptions): DateTime[] {
  const now = opts.now ?? DateTime.now().setZone(opts.tz);
  const day = DateTime.fromISO(opts.date, { zone: opts.tz });

  // 1. horizonte máximo de agenda aberta
  if (day.startOf("day") > now.plus({ days: opts.maxLeadDays })) return [];

  const earliestStart = now.plus({ hours: opts.minLeadHours });
  const total = opts.durationMin + opts.bufferMin;
  const slots: DateTime[] = [];
  // Passo mínimo de 1 minuto: com 0 o laço abaixo nunca avança e trava o
  // processo inteiro (Next é single-threaded). A validação do painel também
  // barra o 0, mas o motor não pode depender disso — dado antigo já pode
  // estar gravado com zero.
  const step = Math.max(1, opts.stepMin);

  for (const [openStr, closeStr] of opts.workingHours) {
    const open = day.set(toHM(openStr));
    const close = day.set(toHM(closeStr));

    // 2. varre em passos de stepMin
    for (
      let t = open;
      t.plus({ minutes: total }) <= close;
      t = t.plus({ minutes: step })
    ) {
      if (t < earliestStart) continue; // lead time mínimo

      const candidate = Interval.fromDateTimes(t, t.plus({ minutes: total }));

      // 3. conflito com ocupados (já incluem o buffer)
      const collides = opts.busy.some((b) =>
        candidate.overlaps(Interval.fromDateTimes(b.start, b.end)),
      );
      if (!collides) slots.push(t);
    }
  }
  return slots;
}

/** Formata os inícios de slot como "HH:mm" para a API/UI. */
export function slotsToHHmm(slots: DateTime[]): string[] {
  return slots.map((s) => s.toFormat("HH:mm"));
}

export interface BookingRow {
  startsAt: DateTime;
  endsAt: DateTime; // já inclui o buffer
  status: "pending" | "confirmed";
  holdExpiresAt: DateTime | null;
}

/**
 * Monta os intervalos ocupados a partir dos bookings: confirmados contam sempre;
 * pending conta apenas enquanto o hold estiver vivo (hold_expires_at > now).
 * É aqui que "hold expirado libera o horário" sem intervenção.
 */
export function busyFromBookings(
  bookings: BookingRow[],
  now: DateTime,
): Range[] {
  return bookings
    .filter(
      (b) =>
        b.status === "confirmed" ||
        (b.status === "pending" &&
          b.holdExpiresAt !== null &&
          b.holdExpiresAt > now),
    )
    .map((b) => ({ start: b.startsAt, end: b.endsAt }));
}
