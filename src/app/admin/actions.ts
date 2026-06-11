"use server";

import { revalidatePath } from "next/cache";
import { DateTime } from "luxon";
import { Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";
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

/** "Maquiagem p/ Festa" → "maquiagem-p-festa" (único: sufixo -2, -3…). */
async function uniqueServiceCode(name: string): Promise<string> {
  const base =
    name
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || "servico";
  let code = base;
  for (let i = 2; ; i++) {
    const exists = await prisma.service.findUnique({ where: { code } });
    if (!exists) return code;
    code = `${base}-${i}`;
  }
}

const SERVICE_CATEGORIES = [
  "social",
  "sobrancelha",
  "curso",
  "noiva",
  "debutante",
] as const;

export async function adminCreateService(formData: FormData): Promise<void> {
  await requireAdmin();

  const name = String(formData.get("name") ?? "").trim();
  if (name.length < 3) fail("Dê um nome ao serviço (mínimo 3 letras).");

  const category = String(formData.get("category") ?? "");
  if (!SERVICE_CATEGORIES.includes(category as never)) {
    fail("Categoria inválida.");
  }

  const priceCents = reaisToCents(formData.get("price"));
  const priceHomeCents = reaisToCents(formData.get("priceHome"));
  const durationMin = Number(formData.get("durationMin"));
  const bufferMin = Number(formData.get("bufferMin"));
  const pendingPrice = formData.get("pendingPrice") === "on";
  if ((priceCents == null && !pendingPrice) || priceCents == null) {
    fail("Informe o preço (ou marque 'preço a confirmar' com preço 0).");
  }
  if (!Number.isInteger(durationMin) || durationMin <= 0) {
    fail("Duração inválida.");
  }

  // R1: noiva/debutante nascem (e permanecem) não-agendáveis online.
  const lockedOffline = category === "noiva" || category === "debutante";

  await prisma.service.create({
    data: {
      code: await uniqueServiceCode(name),
      name,
      category,
      durationMin,
      bufferMin: Number.isInteger(bufferMin) && bufferMin >= 0 ? bufferMin : 15,
      priceCents,
      priceHomeCents,
      bookableOnline: lockedOffline
        ? false
        : formData.get("bookableOnline") === "on",
      pendingPrice,
      requiresDeposit: formData.get("requiresDeposit") === "on",
      isCourse: category === "curso",
      active: true,
    },
  });
  revalidatePath("/admin/servicos");
  revalidatePath("/agendar");
}

export async function adminDeleteService(id: string): Promise<void> {
  await requireAdmin();

  const service = await prisma.service.findUnique({
    where: { id },
    include: {
      _count: { select: { bookings: true, eventSessions: true, waitlist: true } },
    },
  });
  if (!service) fail("Serviço não encontrado.");

  const refs =
    service._count.bookings +
    service._count.eventSessions +
    service._count.waitlist;
  if (refs > 0) {
    fail(
      "Esse serviço já tem atendimentos no histórico — desative em vez de excluir.",
    );
  }

  await prisma.service.delete({ where: { id } });
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

// ── Usuárias do painel ──────────────────────────────────────────────────────

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export async function adminCreateUser(formData: FormData): Promise<void> {
  await requireAdmin();

  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (name.length < 2) fail("Informe o nome.");
  if (!EMAIL_RE.test(email)) fail("E-mail inválido.");
  if (password.length < 8) fail("A senha precisa de pelo menos 8 caracteres.");

  const exists = await prisma.adminUser.findUnique({ where: { email } });
  if (exists) fail("Já existe uma conta com esse e-mail.");

  await prisma.adminUser.create({
    data: { name, email, passwordHash: bcrypt.hashSync(password, 12) },
  });
  revalidatePath("/admin/usuarias");
}

export async function adminToggleUser(id: string): Promise<void> {
  const session = await requireAdmin();

  const user = await prisma.adminUser.findUnique({ where: { id } });
  if (!user) fail("Conta não encontrada.");
  if (user.email === session.user?.email?.toLowerCase()) {
    fail("Você não pode desativar a própria conta.");
  }
  if (user.active) {
    const otherActive = await prisma.adminUser.count({
      where: { active: true, id: { not: id } },
    });
    if (otherActive === 0) fail("Não dá para desativar a última conta ativa.");
  }

  await prisma.adminUser.update({
    where: { id },
    data: { active: !user.active },
  });
  revalidatePath("/admin/usuarias");
}

export async function adminResetUserPassword(
  formData: FormData,
): Promise<void> {
  await requireAdmin();

  const id = String(formData.get("id") ?? "");
  const password = String(formData.get("password") ?? "");
  if (password.length < 8) fail("A senha precisa de pelo menos 8 caracteres.");

  const user = await prisma.adminUser.findUnique({ where: { id } });
  if (!user) fail("Conta não encontrada.");

  await prisma.adminUser.update({
    where: { id },
    data: { passwordHash: bcrypt.hashSync(password, 12) },
  });
  revalidatePath("/admin/usuarias");
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
