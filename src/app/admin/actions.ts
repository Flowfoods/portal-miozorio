"use server";

import { revalidatePath } from "next/cache";
import { DateTime } from "luxon";
import { Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { normalizeE164BR } from "@/lib/phone";
import { ensureClubMember } from "@/lib/clube";
import { getSettings, invalidateSettingsCache } from "@/lib/settings";
import { MIN_SENHA, SENHA_CURTA } from "@/lib/security";
import {
  confirmBooking,
  cancelBooking,
  markNoShow,
  markCompleted,
  createManualBooking,
  rescheduleBooking,
} from "@/lib/booking-service";
import {
  MEDIA_CATEGORIES,
  MAX_UPLOAD_BYTES,
  processUpload,
  deleteMediaFile,
} from "@/lib/media";

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

// ── Encaixe manual + remarcação (M10) ───────────────────────────────────────

/** Monta o objeto de anamnese só com os campos preenchidos (evita {} ruidoso). */
function anamnesisFrom(formData: FormData): Record<string, string> | undefined {
  const out: Record<string, string> = {};
  for (const [key, field] of [
    ["alergia", "alergia"],
    ["referencia", "referencia"],
    ["ocasiao", "ocasiao"],
  ] as const) {
    const v = String(formData.get(field) ?? "").trim();
    if (v) out[key] = v;
  }
  return Object.keys(out).length ? out : undefined;
}

export async function adminCreateManualBooking(
  formData: FormData,
): Promise<void> {
  await requireAdmin();

  const source = String(formData.get("source") ?? "");
  if (source !== "admin_phone" && source !== "admin_whatsapp") {
    fail("Informe como a cliente fechou (telefone ou WhatsApp).");
  }
  const location = formData.get("location") === "home" ? "home" : "studio";

  const r = await createManualBooking({
    serviceId: String(formData.get("serviceId") ?? ""),
    date: String(formData.get("date") ?? ""),
    time: String(formData.get("time") ?? ""),
    location,
    source,
    customerId: String(formData.get("customerId") ?? "") || undefined,
    customerName: String(formData.get("customerName") ?? "") || undefined,
    customerPhone: String(formData.get("customerPhone") ?? "") || undefined,
    anamnesis: anamnesisFrom(formData),
  });
  if (!r.ok) fail(r.message);

  // TODO(M4): se "notify" ligado, disparar confirmação no WhatsApp via Evolution.
  // A integração n8n/Evolution é o M4 (ainda não construído) — não simular envio.
  refreshAgenda();
}

export async function adminRescheduleBooking(
  formData: FormData,
): Promise<void> {
  await requireAdmin();
  const r = await rescheduleBooking(
    String(formData.get("id") ?? ""),
    String(formData.get("date") ?? ""),
    String(formData.get("time") ?? ""),
  );
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
  if (password.length < MIN_SENHA) fail(SENHA_CURTA);

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
  if (password.length < MIN_SENHA) fail(SENHA_CURTA);

  const user = await prisma.adminUser.findUnique({ where: { id } });
  if (!user) fail("Conta não encontrada.");

  await prisma.adminUser.update({
    where: { id },
    data: { passwordHash: bcrypt.hashSync(password, 12) },
  });
  revalidatePath("/admin/usuarias");
}

// ── Fotos do site (M8.4) ────────────────────────────────────────────────────

/** Alt padrão por categoria — a Mi não precisa escrever descrição foto a foto. */
const MEDIA_DEFAULT_ALT: Record<string, string> = {
  hero: "Maquiagem por Milene Ozorio",
  sobre: "Milene Ozorio no estúdio",
  portfolio: "Produção de beleza por Mi Ozorio",
  servico: "Serviço de beleza por Mi Ozorio",
};

function refreshMedia() {
  revalidatePath("/admin/fotos");
  revalidatePath("/");
  revalidatePath("/sobre");
}

export async function adminUploadMedia(formData: FormData): Promise<void> {
  await requireAdmin();

  const category = String(formData.get("category") ?? "");
  if (!MEDIA_CATEGORIES.includes(category as never)) {
    fail("Escolha onde a foto vai aparecer.");
  }
  const files = formData
    .getAll("files")
    .filter((f): f is File => f instanceof File && f.size > 0);
  if (!files.length) fail("Escolha pelo menos uma foto.");

  const alt = String(formData.get("alt") ?? "").trim();
  let saved = 0;
  for (const file of files) {
    if (file.size > MAX_UPLOAD_BYTES) {
      fail(
        saved
          ? `${saved} foto(s) já foram salvas, mas "${file.name}" é muito grande (máximo 12MB por foto).`
          : `"${file.name}" é muito grande (máximo 12MB por foto).`,
      );
    }
    let name: string;
    try {
      name = await processUpload(Buffer.from(await file.arrayBuffer()));
    } catch {
      fail(
        saved
          ? `${saved} foto(s) já foram salvas, mas não consegui ler "${file.name}" — tente enviá-la em JPG ou PNG.`
          : `Não consegui ler "${file.name}" — tente enviá-la em JPG ou PNG.`,
      );
    }
    await prisma.mediaAsset.create({
      data: {
        url: `/media/${name}`,
        alt: alt || MEDIA_DEFAULT_ALT[category] || "Foto Mi Ozorio",
        category,
        published: true,
      },
    });
    saved++;
  }
  refreshMedia();
}

export async function adminToggleMediaPublished(id: string): Promise<void> {
  await requireAdmin();
  const asset = await prisma.mediaAsset.findUnique({ where: { id } });
  if (!asset) fail("Foto não encontrada.");
  await prisma.mediaAsset.update({
    where: { id },
    data: { published: !asset.published },
  });
  refreshMedia();
}

export async function adminUpdateMediaAlt(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const alt = String(formData.get("alt") ?? "").trim();
  if (alt.length < 3) fail("Escreva uma descrição curtinha para a foto.");
  const asset = await prisma.mediaAsset.findUnique({ where: { id } });
  if (!asset) fail("Foto não encontrada.");
  await prisma.mediaAsset.update({ where: { id }, data: { alt } });
  refreshMedia();
}

export async function adminDeleteMedia(id: string): Promise<void> {
  await requireAdmin();
  const asset = await prisma.mediaAsset.findUnique({ where: { id } });
  if (!asset) fail("Foto não encontrada.");
  await prisma.mediaAsset.delete({ where: { id } });
  await deleteMediaFile(asset.url);
  refreshMedia();
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
  revalidatePath(`/admin/clientes/${customerId}`);
}

// ── Ficha da cliente (M11) ──────────────────────────────────────────────────

function refreshFicha(customerId: string) {
  revalidatePath("/admin/clientes");
  revalidatePath(`/admin/clientes/${customerId}`);
  revalidatePath("/admin"); // badge de alergia da agenda lê a ficha
}

export async function adminUpdateCustomer(formData: FormData): Promise<void> {
  await requireAdmin();

  const id = String(formData.get("id") ?? "");
  const customer = await prisma.customer.findUnique({ where: { id } });
  if (!customer) fail("Cliente não encontrada.");

  const name = String(formData.get("name") ?? "").trim();
  if (name.length < 2) fail("Informe o nome da cliente.");

  const phone = normalizeE164BR(String(formData.get("phone") ?? ""));
  if (!phone) fail("WhatsApp inválido — use DDD + número.");
  if (phone !== customer.phoneE164) {
    const taken = await prisma.customer.findUnique({
      where: { phoneE164: phone },
    });
    if (taken) fail("Já existe outra cliente com esse WhatsApp.");
  }

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (email && !EMAIL_RE.test(email)) fail("E-mail inválido.");

  const birthRaw = String(formData.get("birthDate") ?? "").trim();
  let birthDate: Date | null = null;
  if (birthRaw) {
    const d = DateTime.fromISO(birthRaw, { zone: "utc" });
    if (!d.isValid || d > DateTime.utc()) fail("Data de nascimento inválida.");
    birthDate = d.toJSDate();
  }

  // R6: responsável de menor — telefone, se informado, também vira E.164 (R5).
  const guardianName =
    String(formData.get("guardianName") ?? "").trim() || null;
  const guardianRaw = String(formData.get("guardianPhone") ?? "").trim();
  let guardianPhone: string | null = null;
  if (guardianRaw) {
    guardianPhone = normalizeE164BR(guardianRaw);
    if (!guardianPhone) fail("Telefone do responsável inválido.");
  }

  await prisma.customer.update({
    where: { id },
    data: { name, phoneE164: phone, email: email || null, birthDate, guardianName, guardianPhone },
  });
  refreshFicha(id);
}

export async function adminUpdateCustomerCare(
  formData: FormData,
): Promise<void> {
  await requireAdmin();

  const id = String(formData.get("id") ?? "");
  const customer = await prisma.customer.findUnique({ where: { id } });
  if (!customer) fail("Cliente não encontrada.");

  await prisma.customer.update({
    where: { id },
    data: {
      allergies: String(formData.get("allergies") ?? "").trim() || null,
      notes: String(formData.get("notes") ?? "").trim() || null,
    },
  });
  refreshFicha(id);
}

// ── Clube de Fidelidade ─────────────────────────────────────────────────────

/** Inclui a cliente no clube pelo painel (gera código de indicação). */
export async function adminEnrollCustomer(customerId: string): Promise<void> {
  await requireAdmin();
  const member = await ensureClubMember(customerId);
  if (!member) fail("Cliente não encontrada.");
  revalidatePath(`/admin/clientes/${customerId}`);
  revalidatePath("/admin/clube");
}

/** Mi marca o mimo da escada como entregue. */
export async function adminRedeemMilestone(id: string): Promise<void> {
  await requireAdmin();
  const marco = await prisma.referralMilestone.findUnique({ where: { id } });
  if (!marco) fail("Marco não encontrado.");
  if (marco.resgatadoEm) fail("Esse mimo já foi marcado como entregue.");
  await prisma.referralMilestone.update({
    where: { id },
    data: { resgatadoEm: new Date() },
  });
  revalidatePath("/admin/clube");
  revalidatePath(`/admin/clientes/${marco.customerId}`);
}

/** Registra um brinde avulso entregue (aniversário, cortesia). */
export async function adminAddRedemption(formData: FormData): Promise<void> {
  await requireAdmin();
  const customerId = String(formData.get("customerId") ?? "");
  const beneficio = String(formData.get("beneficio") ?? "").trim();
  if (beneficio.length < 3) fail("Descreva o brinde entregue.");
  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
  });
  if (!customer) fail("Cliente não encontrada.");
  await prisma.clubRedemption.create({
    data: { customerId, beneficio, origem: "manual" },
  });
  revalidatePath("/admin/clube");
  revalidatePath(`/admin/clientes/${customerId}`);
}

/** R18: foto da cliente só com autorização registrada (com data da mudança). */
export async function adminSetPhotoConsent(
  customerId: string,
  consent: boolean,
): Promise<void> {
  await requireAdmin();
  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
  });
  if (!customer) fail("Cliente não encontrada.");
  await prisma.customer.update({
    where: { id: customerId },
    data: { photoConsent: consent, photoConsentAt: new Date() },
  });
  refreshFicha(customerId);
}
