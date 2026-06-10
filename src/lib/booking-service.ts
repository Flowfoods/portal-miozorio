import { DateTime } from "luxon";
import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { getSettings } from "./settings";
import { normalizeE164BR } from "./phone";
import { evaluateCancellation } from "./policies";

export interface CreateBookingInput {
  serviceId: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  location: "studio" | "home";
  customer: {
    name: string;
    phone: string;
    email?: string;
    birthDate?: string;
    guardianName?: string;
    guardianPhone?: string;
  };
  anamnesis?: Record<string, unknown>;
  lgpdConsent: boolean;
}

export type CreateBookingResult =
  | { ok: true; id: string; holdExpiresAt: string }
  | {
      ok: false;
      code:
        | "invalid_service"
        | "not_bookable"
        | "invalid_phone"
        | "invalid_datetime"
        | "slot_taken"
        | "no_consent";
      message: string;
    };

function isExclusionViolation(e: unknown): boolean {
  // 23P01 = exclusion_violation da constraint no_overlap (R2).
  const msg = String((e as { message?: string })?.message ?? e);
  return msg.includes("23P01") || msg.includes("no_overlap");
}

export async function createBooking(
  input: CreateBookingInput,
): Promise<CreateBookingResult> {
  if (!input.lgpdConsent) {
    return {
      ok: false,
      code: "no_consent",
      message: "É preciso aceitar a política de privacidade.",
    };
  }

  const settings = await getSettings();
  const tz = settings.timezone;

  const service = await prisma.service.findUnique({
    where: { id: input.serviceId },
  });
  if (!service || !service.active) {
    return {
      ok: false,
      code: "invalid_service",
      message: "Serviço não encontrado.",
    };
  }
  if (!service.bookableOnline) {
    return {
      ok: false,
      code: "not_bookable",
      message: "Esse atendimento é combinado direto com a Mi no WhatsApp 💛",
    };
  }

  const phone = normalizeE164BR(input.customer.phone);
  if (!phone) {
    return { ok: false, code: "invalid_phone", message: "WhatsApp inválido." };
  }

  const startsAt = DateTime.fromISO(`${input.date}T${input.time}`, { zone: tz });
  if (!startsAt.isValid) {
    return {
      ok: false,
      code: "invalid_datetime",
      message: "Data ou horário inválido.",
    };
  }
  const endsAt = startsAt.plus({
    minutes: service.durationMin + service.bufferMin,
  });

  const priceCents =
    input.location === "home" && service.priceHomeCents != null
      ? service.priceHomeCents
      : service.priceCents;

  const professional = await prisma.professional.findFirst({
    where: { active: true },
  });

  const now = DateTime.now().setZone(tz);
  const holdExpiresAt = now.plus({ minutes: settings.holdMinutes });

  const guardianPhone = input.customer.guardianPhone
    ? normalizeE164BR(input.customer.guardianPhone)
    : null;
  const birthDate = input.customer.birthDate
    ? new Date(input.customer.birthDate)
    : null;

  const customer = await prisma.customer.upsert({
    where: { phoneE164: phone },
    update: {
      name: input.customer.name,
      email: input.customer.email ?? null,
      guardianName: input.customer.guardianName ?? null,
      guardianPhone,
      birthDate,
      lgpdConsentAt: new Date(),
    },
    create: {
      name: input.customer.name,
      phoneE164: phone,
      email: input.customer.email ?? null,
      guardianName: input.customer.guardianName ?? null,
      guardianPhone,
      birthDate,
      lgpdConsentAt: new Date(),
    },
  });

  try {
    const booking = await prisma.$transaction(async (tx) => {
      const created = await tx.booking.create({
        data: {
          customerId: customer.id,
          serviceId: service.id,
          professionalId: professional?.id ?? null,
          startsAt: startsAt.toJSDate(),
          endsAt: endsAt.toJSDate(),
          status: "pending",
          location: input.location,
          priceCents,
          holdExpiresAt: holdExpiresAt.toJSDate(),
          ...(input.anamnesis !== undefined
            ? { anamnesis: input.anamnesis as Prisma.InputJsonValue }
            : {}),
          source: "web",
        },
      });
      await tx.bookingEvent.create({
        data: { bookingId: created.id, toStatus: "pending", actor: "customer" },
      });
      return created;
    });
    return {
      ok: true,
      id: booking.id,
      holdExpiresAt: holdExpiresAt.toISO() ?? "",
    };
  } catch (e) {
    if (isExclusionViolation(e)) {
      return {
        ok: false,
        code: "slot_taken",
        message: "Esse horário acabou de ser reservado 😔",
      };
    }
    throw e;
  }
}

export type ConfirmResult =
  | { ok: true; status: "confirmed" }
  | {
      ok: false;
      code: "not_found" | "not_pending" | "hold_expired" | "requires_deposit";
      message: string;
    };

export async function confirmBooking(id: string): Promise<ConfirmResult> {
  const booking = await prisma.booking.findUnique({
    where: { id },
    include: { customer: true, service: true },
  });
  if (!booking) {
    return { ok: false, code: "not_found", message: "Reserva não encontrada." };
  }
  if (booking.status !== "pending") {
    return {
      ok: false,
      code: "not_pending",
      message: "Essa reserva não está mais pendente.",
    };
  }
  if (!booking.holdExpiresAt || booking.holdExpiresAt <= new Date()) {
    return {
      ok: false,
      code: "hold_expired",
      message: "O tempo da reserva expirou. Tente escolher o horário de novo 💛",
    };
  }
  const needsDeposit =
    booking.customer.requiresDeposit || booking.service.requiresDeposit;
  if (needsDeposit && !booking.depositPaidAt) {
    return {
      ok: false,
      code: "requires_deposit",
      message: "Esse agendamento precisa de um sinal para confirmar.",
    };
  }

  await prisma.$transaction(async (tx) => {
    await tx.booking.update({
      where: { id },
      data: { status: "confirmed", holdExpiresAt: null },
    });
    await tx.bookingEvent.create({
      data: {
        bookingId: id,
        fromStatus: "pending",
        toStatus: "confirmed",
        actor: "system",
      },
    });
  });
  return { ok: true, status: "confirmed" };
}

export type CancelResult =
  | {
      ok: true;
      status: "cancelled_by_client" | "cancelled_by_business";
      depositRetained: boolean;
      strikes: number;
      requiresDeposit: boolean;
    }
  | { ok: false; code: "not_found" | "not_cancellable"; message: string };

export async function cancelBooking(
  id: string,
  actor: "client" | "business",
): Promise<CancelResult> {
  const booking = await prisma.booking.findUnique({
    where: { id },
    include: { customer: true },
  });
  if (!booking) {
    return { ok: false, code: "not_found", message: "Reserva não encontrada." };
  }
  if (booking.status !== "pending" && booking.status !== "confirmed") {
    return {
      ok: false,
      code: "not_cancellable",
      message: "Essa reserva não pode mais ser cancelada.",
    };
  }

  const settings = await getSettings();
  const tz = settings.timezone;
  const result = evaluateCancellation({
    startsAt: DateTime.fromJSDate(booking.startsAt).setZone(tz),
    now: DateTime.now().setZone(tz),
    cancelWindowDays: settings.cancelWindowDays,
    currentStrikes: booking.customer.strikes,
    strikeLimit: settings.strikeLimit,
    hasDeposit: booking.depositPaidAt != null,
    actor,
  });

  await prisma.$transaction(async (tx) => {
    await tx.booking.update({
      where: { id },
      data: { status: result.finalStatus, holdExpiresAt: null },
    });
    await tx.bookingEvent.create({
      data: {
        bookingId: id,
        fromStatus: booking.status,
        toStatus: result.finalStatus,
        actor,
        reason: result.depositRetained
          ? "fora_do_prazo_sinal_retido"
          : undefined,
      },
    });
    if (actor === "client") {
      await tx.customer.update({
        where: { id: booking.customerId },
        data: {
          strikes: result.newStrikes,
          requiresDeposit:
            booking.customer.requiresDeposit || result.requiresDeposit,
        },
      });
    }
  });

  return {
    ok: true,
    status: result.finalStatus,
    depositRetained: result.depositRetained,
    strikes: result.newStrikes,
    requiresDeposit: result.requiresDeposit,
  };
}

export async function getBookingStatus(id: string) {
  const b = await prisma.booking.findUnique({
    where: { id },
    select: {
      id: true,
      status: true,
      holdExpiresAt: true,
      startsAt: true,
      endsAt: true,
    },
  });
  if (!b) return null;
  return {
    id: b.id,
    status: b.status,
    holdExpiresAt: b.holdExpiresAt?.toISOString() ?? null,
    startsAt: b.startsAt.toISOString(),
    endsAt: b.endsAt.toISOString(),
  };
}
