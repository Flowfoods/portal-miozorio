"use server";

import { revalidatePath } from "next/cache";
import { DateTime } from "luxon";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { getSettings, invalidateSettingsCache } from "@/lib/settings";
import {
  confirmBooking,
  cancelBooking,
  markNoShow,
  markCompleted,
} from "@/lib/booking-service";

/**
 * Server actions do painel /admin (M5). Todas exigem sessão (requireAdmin) —
 * o middleware protege as páginas, isto protege as mutações (defesa dupla).
 * Toda transição de booking passa pelo booking-service (auditoria em
 * booking_events — nunca update direto de status aqui).
 */

/** Falha de regra/validação vira throw — exibida pelo error.tsx do /admin. */
function fail(message: string): never {
  throw new Error(message);
}

function refreshAgenda() {
  revalidatePath("/admin");
  revalidatePath("/admin/clientes");
}

export async function adminConfirmBooking(id: string): Promise<void> {
  await requireAdmin();
  const r = await confirmBooking(id, "business");
  refreshAgenda();
  if (!r.ok) fail(r.message);
}

export async function adminCancelBooking(id: string): Promise<void> {
  await requireAdmin();
  const r = await cancelBooking(id, "business");
  refreshAgenda();
  if (!r.ok) fail(r.message);
}

export async function adminMarkNoShow(id: string): Promise<void> {
  await requireAdmin();
  const r = await markNoShow(id);
  refreshAgenda();
  if (!r.ok) fail(r.message);
}

export async function adminMarkCompleted(id: string): Promise<void> {
  await requireAdmin();
  const r = await markCompleted(id);
  refreshAgenda();
  if (!r.ok) fail(r.message);
}

// ── Serviços ────────────────────────────────────────────────────────────────

const reaisToCents = (v: FormDataEntryValue | null): number | null => {
  const raw = String(v ?? "").trim();
  if (!raw) return null;
  // Com vírgula ("1.250,00") o ponto é milhar; sem vírgula ("250.00") é decimal.
  const s = raw.includes(",")
    ? raw.replace(/\./g, "").replace(",", ".")
    : raw;
  const n = Number(s);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : null;
};

export async function adminUpdateService(
  formData: FormData,
): Promise<void> {
  await requireAdmin();

  const id = String(formData.get("id") ?? "");
  const service = await prisma.service.findUnique({ where: { id } });
  if (!service) fail("Serviço não encontrado.");

  const priceCents = reaisToCents(formData.get("price"));
  const priceHomeCents = reaisToCents(formData.get("priceHome"));
  const durationMin = Number(formData.get("durationMin"));
  const bufferMin = Number(formData.get("bufferMin"));
  if (priceCents == null || !Number.isInteger(durationMin) || durationMin <= 0) {
    fail("Preço ou duração inválidos.");
  }

  // R1: noiva/debutante NUNCA viram agendáveis online — nem pelo painel.
  const lockedOffline =
    service.category === "noiva" || service.category === "debutante";

  await prisma.service.update({
    where: { id },
    data: {
      priceCents,
      priceHomeCents,
      durationMin,
      bufferMin: Number.isInteger(bufferMin) && bufferMin >= 0 ? bufferMin : 15,
      active: formData.get("active") === "on",
      pendingPrice: formData.get("pendingPrice") === "on",
      bookableOnline: lockedOffline
        ? false
        : formData.get("bookableOnline") === "on",
      requiresDeposit: formData.get("requiresDeposit") === "on",
    },
  });
  revalidatePath("/admin/servicos");
  revalidatePath("/agendar");
}

// ── Configurações do negócio (R3) ───────────────────────────────────────────

const HOURS_RE = /^([01]\d|2[0-3]):[0-5]\d-([01]\d|2[0-3]):[0-5]\d$/;
const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;

/** "09:00-19:00, 20:00-22:00" → [["09:00","19:00"],["20:00","22:00"]]. */
function parseDayRanges(raw: string): [string, string][] | null {
  const s = raw.trim();
  if (!s) return [];
  const out: [string, string][] = [];
  for (const part of s.split(",")) {
    const range = part.trim();
    if (!HOURS_RE.test(range)) return null;
    const [a = "", b = ""] = range.split("-");
    if (!a || !b || a >= b) return null;
    out.push([a, b]);
  }
  return out;
}

export async function adminSaveSettings(
  formData: FormData,
): Promise<void> {
  await requireAdmin();

  const numeric: Record<string, number> = {};
  for (const key of [
    "buffer_min",
    "min_lead_hours",
    "max_lead_days",
    "reminder_hours",
    "cancel_window_days",
    "strike_limit",
    "hold_minutes",
    "slot_step_min",
  ]) {
    const n = Number(formData.get(key));
    if (!Number.isFinite(n) || n < 0) {
      fail(`Valor inválido em ${key}.`);
    }
    numeric[key] = n;
  }

  const workingHours: Record<string, [string, string][]> = {};
  for (const day of DAYS) {
    const ranges = parseDayRanges(String(formData.get(`wh_${day}`) ?? ""));
    if (ranges == null) {
      fail(`Horário inválido (${day}). Use o formato 09:00-19:00.`);
    }
    workingHours[day] = ranges;
  }

  const entries: [string, Prisma.InputJsonValue][] = [
    ...Object.entries(numeric),
    ["working_hours", workingHours],
  ];
  for (const [key, value] of entries) {
    await prisma.businessSetting.upsert({
      where: { key },
      update: { value },
      create: { key, value },
    });
  }
  invalidateSettingsCache();
  revalidatePath("/admin/config");
}

// ── Bloqueios de agenda ─────────────────────────────────────────────────────

export async function adminCreateBlock(
  formData: FormData,
): Promise<void> {
  await requireAdmin();

  const settings = await getSettings();
  const starts = DateTime.fromISO(String(formData.get("startsAt") ?? ""), {
    zone: settings.timezone,
  });
  const ends = DateTime.fromISO(String(formData.get("endsAt") ?? ""), {
    zone: settings.timezone,
  });
  if (!starts.isValid || !ends.isValid || ends <= starts) {
    fail("Período inválido.");
  }

  await prisma.scheduleBlock.create({
    data: {
      startsAt: starts.toJSDate(),
      endsAt: ends.toJSDate(),
      reason: String(formData.get("reason") ?? "").trim() || null,
    },
  });
  revalidatePath("/admin/bloqueios");
}

export async function adminDeleteBlock(id: string): Promise<void> {
  await requireAdmin();
  await prisma.scheduleBlock.delete({ where: { id } }).catch(() => null);
  revalidatePath("/admin/bloqueios");
}

// ── Clientes ────────────────────────────────────────────────────────────────

export async function adminResetStrikes(
  customerId: string,
): Promise<void> {
  await requireAdmin();
  await prisma.customer.update({
    where: { id: customerId },
    data: { strikes: 0, requiresDeposit: false },
  });
  revalidatePath("/admin/clientes");
}
