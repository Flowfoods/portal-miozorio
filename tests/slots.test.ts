import { describe, it, expect } from "vitest";
import { DateTime } from "luxon";
import {
  generateSlots,
  slotsToHHmm,
  busyFromBookings,
  type BookingRow,
} from "@/lib/slots";

const TZ = "America/Sao_Paulo";
const mk = (iso: string) => DateTime.fromISO(iso, { zone: TZ });

// Base: serviço de 60min + buffer 15 (total 75), grade de 30min, sáb 09–19.
const base = {
  date: "2026-06-13", // sábado
  tz: TZ,
  workingHours: [["09:00", "19:00"]] as [string, string][],
  durationMin: 60,
  bufferMin: 15,
  stepMin: 30,
  minLeadHours: 24,
  maxLeadDays: 90,
  now: mk("2026-06-11T09:00"), // 2 dias antes → dia todo elegível
};

describe("generateSlots (motor de agendamento)", () => {
  it("M1.5#1 — slot não nasce dentro de bloqueio nem colide com hold ativo", () => {
    const heldPending: BookingRow = {
      startsAt: mk("2026-06-13T17:00"),
      endsAt: mk("2026-06-13T18:15"),
      status: "pending",
      holdExpiresAt: base.now.plus({ minutes: 5 }), // hold vivo
    };
    const busy = [
      { start: mk("2026-06-13T13:00"), end: mk("2026-06-13T15:00") }, // bloqueio
      ...busyFromBookings([heldPending], base.now),
    ];

    const slots = slotsToHHmm(generateSlots({ ...base, busy }));

    expect(slots).toContain("09:00");
    expect(slots).toContain("11:30");
    expect(slots).toContain("15:00");
    expect(slots).not.toContain("13:00"); // dentro do bloqueio
    expect(slots).not.toContain("14:00"); // dentro do bloqueio
    expect(slots).not.toContain("17:00"); // hold ativo
  });

  it("M1.5#2 — hold expirado libera o horário; hold vivo ocupa", () => {
    const booking = (holdExpiresAt: DateTime | null): BookingRow => ({
      startsAt: mk("2026-06-13T10:00"),
      endsAt: mk("2026-06-13T11:15"),
      status: "pending",
      holdExpiresAt,
    });

    // hold expirado (no passado) → não conta → 10:00 livre
    const expired = busyFromBookings(
      [booking(base.now.minus({ minutes: 1 }))],
      base.now,
    );
    expect(expired).toHaveLength(0);
    expect(slotsToHHmm(generateSlots({ ...base, busy: expired }))).toContain(
      "10:00",
    );

    // hold vivo (no futuro) → ocupa → 10:00 indisponível
    const alive = busyFromBookings(
      [booking(base.now.plus({ minutes: 5 }))],
      base.now,
    );
    expect(alive).toHaveLength(1);
    expect(
      slotsToHHmm(generateSlots({ ...base, busy: alive })),
    ).not.toContain("10:00");
  });

  it("M1.5#4 — lead time mínimo respeitado na virada do dia (23h p/ amanhã, lead 24h → vazio)", () => {
    const slots = generateSlots({
      ...base,
      busy: [],
      now: mk("2026-06-12T23:00"), // véspera às 23h
    });
    expect(slots).toHaveLength(0); // amanhã 09–19 todo antes de (agora+24h)
  });

  it("M1.5#5 — buffer refletido na distância entre slots consecutivos", () => {
    const comDate = "2026-06-13";
    const comum = {
      tz: TZ,
      date: comDate,
      workingHours: [["09:00", "12:00"]] as [string, string][],
      durationMin: 60,
      minLeadHours: 0,
      maxLeadDays: 90,
      busy: [],
      now: mk("2026-06-13T00:00"),
    };

    // agenda encaixada: passo = duração + buffer
    const comBuffer = generateSlots({ ...comum, bufferMin: 15, stepMin: 75 });
    expect(comBuffer).toHaveLength(2); // 09:00 e 10:15
    expect(comBuffer[1]!.diff(comBuffer[0]!, "minutes").minutes).toBe(75);

    // sem buffer: passo = só a duração
    const semBuffer = generateSlots({ ...comum, bufferMin: 0, stepMin: 60 });
    expect(semBuffer).toHaveLength(3); // 09:00, 10:00, 11:00
    expect(semBuffer[1]!.diff(semBuffer[0]!, "minutes").minutes).toBe(60);
  });

  it("respeita o horizonte máximo de agenda (maxLeadDays)", () => {
    const slots = generateSlots({
      ...base,
      busy: [],
      date: "2026-12-31", // muito além de 90 dias de 2026-06-11
    });
    expect(slots).toHaveLength(0);
  });
});
