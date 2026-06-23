import { DateTime } from "luxon";
import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { getSettings } from "./settings";
import { normalizeE164BR } from "./phone";
import { evaluateCancellation, evaluateNoShow } from "./policies";
import {
  creditarPontosServico,
  creditarPontosIndicacao,
} from "./clube-pontos";

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
      message: "Esse atendimento é combinado direto com a Mi no WhatsApp",
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
        message: "Esse horário acabou de ser reservado",
      };
    }
    throw e;
  }
}

// ── Encaixe manual pela Mi (M10) ─────────────────────────────────────────────

export interface ManualBookingInput {
  serviceId: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  location: "studio" | "home";
  /** Origem do encaixe — alimenta o dashboard do M14. */
  source: "admin_phone" | "admin_whatsapp";
  /** Cliente existente (id) OU cadastro rápido (name+phone). */
  customerId?: string;
  customerName?: string;
  customerPhone?: string;
  anamnesis?: Record<string, unknown>;
}

export type ManualBookingResult =
  | { ok: true; id: string }
  | {
      ok: false;
      code:
        | "invalid_service"
        | "invalid_customer"
        | "invalid_phone"
        | "invalid_datetime"
        | "slot_taken";
      message: string;
    };

/**
 * Cria um agendamento direto pela Mi (cliente ligou/fechou no WhatsApp).
 * Nasce `confirmed` (sem hold), auditado com actor `admin` (R17). Ignora lead
 * time e horário de funcionamento — a Mi decide —, MAS a colisão de horário
 * continua soberana no banco (R2): no 23P01 nomeia quem já ocupa o horário.
 * Diferente de createBooking, aceita serviços não-agendáveis online
 * (noiva/debutante): a Mi pode bloquear o estúdio por eles pelo painel.
 */
export async function createManualBooking(
  input: ManualBookingInput,
): Promise<ManualBookingResult> {
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

  // Cliente: existente por id, ou cadastro rápido (upsert por telefone).
  let customerId = input.customerId ?? null;
  if (!customerId) {
    const name = (input.customerName ?? "").trim();
    if (name.length < 2) {
      return {
        ok: false,
        code: "invalid_customer",
        message: "Informe o nome da cliente.",
      };
    }
    const phone = normalizeE164BR(input.customerPhone ?? "");
    if (!phone) {
      return {
        ok: false,
        code: "invalid_phone",
        message: "WhatsApp da cliente inválido.",
      };
    }
    const customer = await prisma.customer.upsert({
      where: { phoneE164: phone },
      update: { name },
      create: { name, phoneE164: phone },
    });
    customerId = customer.id;
  } else {
    const exists = await prisma.customer.findUnique({
      where: { id: customerId },
    });
    if (!exists) {
      return {
        ok: false,
        code: "invalid_customer",
        message: "Cliente não encontrada.",
      };
    }
  }

  const priceCents =
    input.location === "home" && service.priceHomeCents != null
      ? service.priceHomeCents
      : service.priceCents;

  const professional = await prisma.professional.findFirst({
    where: { active: true },
  });

  try {
    const booking = await prisma.$transaction(async (tx) => {
      const created = await tx.booking.create({
        data: {
          customerId,
          serviceId: service.id,
          professionalId: professional?.id ?? null,
          startsAt: startsAt.toJSDate(),
          endsAt: endsAt.toJSDate(),
          status: "confirmed",
          location: input.location,
          priceCents,
          holdExpiresAt: null,
          ...(input.anamnesis !== undefined
            ? { anamnesis: input.anamnesis as Prisma.InputJsonValue }
            : {}),
          source: input.source,
        },
      });
      await tx.bookingEvent.create({
        data: {
          bookingId: created.id,
          toStatus: "confirmed",
          actor: "admin",
          reason: "encaixe_manual",
        },
      });
      return created;
    });
    return { ok: true, id: booking.id };
  } catch (e) {
    if (isExclusionViolation(e)) {
      const clash = await findOverlappingBooking(startsAt.toJSDate(), endsAt.toJSDate());
      const who = clash?.customer.name.split(" ")[0];
      return {
        ok: false,
        code: "slot_taken",
        message: who
          ? `Esse horário já está ocupado com ${who}.`
          : "Esse horário já está ocupado.",
      };
    }
    throw e;
  }
}

/** Acha um booking vivo (pending vivo/confirmed) que sobrepõe o intervalo. */
async function findOverlappingBooking(startsAt: Date, endsAt: Date) {
  return prisma.booking.findFirst({
    where: {
      startsAt: { lt: endsAt },
      endsAt: { gt: startsAt },
      OR: [
        { status: "confirmed" },
        { status: "pending", holdExpiresAt: { gt: new Date() } },
      ],
    },
    include: { customer: true },
  });
}

export type RescheduleResult =
  | { ok: true }
  | {
      ok: false;
      code: "not_found" | "invalid_status" | "invalid_datetime" | "slot_taken";
      message: string;
    };

/**
 * Remarca um agendamento pelo painel (M10.3). Mantém o status (pending/
 * confirmed) e só move starts/ends; colisão barrada no banco (R2). Registra
 * em booking_events com o de/para no `reason` (o enum não tem `rescheduled`).
 */
export async function rescheduleBooking(
  id: string,
  date: string,
  time: string,
): Promise<RescheduleResult> {
  const booking = await prisma.booking.findUnique({
    where: { id },
    include: { service: true },
  });
  if (!booking) {
    return { ok: false, code: "not_found", message: "Reserva não encontrada." };
  }
  if (booking.status !== "pending" && booking.status !== "confirmed") {
    return {
      ok: false,
      code: "invalid_status",
      message: "Só agendamentos ativos podem ser remarcados.",
    };
  }

  const settings = await getSettings();
  const tz = settings.timezone;
  const startsAt = DateTime.fromISO(`${date}T${time}`, { zone: tz });
  if (!startsAt.isValid) {
    return {
      ok: false,
      code: "invalid_datetime",
      message: "Data ou horário inválido.",
    };
  }
  const endsAt = startsAt.plus({
    minutes: booking.service.durationMin + booking.service.bufferMin,
  });

  const fmt = (d: Date) =>
    DateTime.fromJSDate(d).setZone(tz).toFormat("dd/LL HH:mm");
  const reason = `remarcado: ${fmt(booking.startsAt)} → ${startsAt.toFormat("dd/LL HH:mm")}`;

  try {
    await prisma.$transaction(async (tx) => {
      await tx.booking.update({
        where: { id },
        data: { startsAt: startsAt.toJSDate(), endsAt: endsAt.toJSDate() },
      });
      await tx.bookingEvent.create({
        data: {
          bookingId: id,
          fromStatus: booking.status,
          toStatus: booking.status,
          actor: "admin",
          reason,
        },
      });
    });
    return { ok: true };
  } catch (e) {
    if (isExclusionViolation(e)) {
      return {
        ok: false,
        code: "slot_taken",
        message: "Esse horário já está ocupado. Escolha outro",
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

export async function confirmBooking(
  id: string,
  actor: "system" | "business" = "system",
): Promise<ConfirmResult> {
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
  // A Mi pode confirmar manualmente mesmo com hold vencido (a vaga continua
  // ocupada pela linha pending até alguém limpar — confirmar é decisão dela).
  const holdCheckApplies = actor !== "business";
  if (
    holdCheckApplies &&
    (!booking.holdExpiresAt || booking.holdExpiresAt <= new Date())
  ) {
    return {
      ok: false,
      code: "hold_expired",
      message: "O tempo da reserva expirou. Tente escolher o horário de novo",
    };
  }
  // Sinal recebido por fora (PIX direto pra Mi) não passa pelo sistema:
  // confirmação manual dela não exige deposit_paid_at.
  const needsDeposit =
    actor !== "business" &&
    (booking.customer.requiresDeposit || booking.service.requiresDeposit);
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
        actor,
      },
    });
  });
  return { ok: true, status: "confirmed" };
}

export type AdminTransitionResult =
  | { ok: true; status: "no_show" | "completed" }
  | { ok: false; code: "not_found" | "invalid_status"; message: string };

/** No-show marcado pela Mi: +1 strike, retém sinal (se houver) — política §3. */
export async function markNoShow(id: string): Promise<AdminTransitionResult> {
  const booking = await prisma.booking.findUnique({
    where: { id },
    include: { customer: true },
  });
  if (!booking) {
    return { ok: false, code: "not_found", message: "Reserva não encontrada." };
  }
  if (booking.status !== "confirmed" && booking.status !== "pending") {
    return {
      ok: false,
      code: "invalid_status",
      message: "Só agendamentos pendentes/confirmados viram no-show.",
    };
  }

  const settings = await getSettings();
  const result = evaluateNoShow({
    currentStrikes: booking.customer.strikes,
    strikeLimit: settings.strikeLimit,
    hasDeposit: booking.depositPaidAt != null,
  });

  await prisma.$transaction(async (tx) => {
    await tx.booking.update({
      where: { id },
      data: { status: "no_show", holdExpiresAt: null },
    });
    await tx.bookingEvent.create({
      data: {
        bookingId: id,
        fromStatus: booking.status,
        toStatus: "no_show",
        actor: "business",
        reason: result.depositRetained ? "sinal_retido" : undefined,
      },
    });
    await tx.customer.update({
      where: { id: booking.customerId },
      data: {
        strikes: result.newStrikes,
        requiresDeposit:
          booking.customer.requiresDeposit || result.requiresDeposit,
      },
    });
  });
  return { ok: true, status: "no_show" };
}

/** Atendimento realizado — dispara o pós-atendimento no M4 (avaliação+foto). */
export async function markCompleted(id: string): Promise<AdminTransitionResult> {
  const booking = await prisma.booking.findUnique({ where: { id } });
  if (!booking) {
    return { ok: false, code: "not_found", message: "Reserva não encontrada." };
  }
  if (booking.status !== "confirmed") {
    return {
      ok: false,
      code: "invalid_status",
      message: "Só agendamentos confirmados podem ser concluídos.",
    };
  }

  await prisma.$transaction(async (tx) => {
    await tx.booking.update({
      where: { id },
      data: { status: "completed" },
    });
    await tx.bookingEvent.create({
      data: {
        bookingId: id,
        fromStatus: "confirmed",
        toStatus: "completed",
        actor: "business",
      },
    });
  });

  // Clube por pontos (idempotente — R10). Falha aqui não desfaz a conclusão:
  //  (1) pontos do serviço para a própria cliente (se for membro);
  //  (2) pontos de indicação para a embaixadora (se a cliente foi indicada) —
  //      emite parabéns via n8n.
  try {
    await creditarPontosServico(id);
    await creditarPontosIndicacao(booking.customerId);
  } catch (e) {
    console.error("clube: falha ao creditar pontos", e);
  }

  return { ok: true, status: "completed" };
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
