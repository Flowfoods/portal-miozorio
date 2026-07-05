"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { DateTime } from "luxon";
import { Prisma, FunilEtapa } from "@prisma/client";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { normalizeE164BR } from "@/lib/phone";
import { ensureClubMember } from "@/lib/clube";
import { criarCliente } from "@/lib/cliente";
import {
  resgatarRecompensa,
  ajustarPontosManual,
  marcarVoucherEntregue,
} from "@/lib/clube-pontos";
import { dispatchEvent, buildEventMessage } from "@/lib/notify";
import { CONTENT_FIELDS, invalidateContentCache } from "@/lib/content";
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
  processPrivatePhoto,
  deletePrivatePhoto,
  MAX_BOOKING_PHOTO_BYTES,
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

/** Lê os itens (multi-serviço) do FormData (JSON string). Defensivo. */
function parseBookingItems(raw: FormDataEntryValue | null): {
  serviceId: string;
  precoCobradoCents: number;
  motivoAjuste?: string;
}[] {
  if (typeof raw !== "string" || !raw) return [];
  try {
    const arr: unknown = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr
      .filter(
        (
          x,
        ): x is {
          serviceId: string;
          precoCobradoCents?: unknown;
          motivoAjuste?: unknown;
        } =>
          !!x && typeof (x as { serviceId?: unknown }).serviceId === "string",
      )
      .map((x) => {
        const motivo =
          typeof x.motivoAjuste === "string" && x.motivoAjuste.trim()
            ? x.motivoAjuste.trim().slice(0, 200)
            : undefined;
        return {
          serviceId: x.serviceId,
          precoCobradoCents: Math.max(
            0,
            Math.round(Number(x.precoCobradoCents) || 0),
          ),
          ...(motivo ? { motivoAjuste: motivo } : {}),
        };
      });
  } catch {
    return [];
  }
}

/**
 * Cadastro rápido de cliente (feature 4): cria a partir de nome + telefone,
 * checando duplicidade por telefone (se já existe, devolve a existente).
 * Chamado direto pelo NovoAgendamento (client) — por isso retorna a cliente.
 */
export async function adminQuickCreateCustomer(
  name: string,
  phone: string,
): Promise<
  | {
      ok: true;
      existed: boolean;
      customer: {
        id: string;
        name: string;
        phoneE164: string;
        strikes: number;
      };
    }
  | { ok: false; message: string }
> {
  await requireAdmin();
  // Mesmo serviço único de onboarding do cadastro manual (paridade de benefícios).
  const r = await criarCliente({ name, phone });
  if (!r.ok) return { ok: false, message: r.message };
  const c = r.customer;
  return {
    ok: true,
    existed: r.existed,
    customer: {
      id: c.id,
      name: c.name,
      phoneE164: c.phoneE164,
      strikes: c.strikes,
    },
  };
}

/**
 * Cadastro manual de cliente pela Mi (aba Clientes). Passa pelo MESMO
 * `criarCliente()` do fluxo normal → onboarding completo (clube + código de
 * indicação + acesso ao portal). Dedup por telefone: já existe → abre a ficha.
 */
export async function adminCriarClienteManual(
  _prev: { error: string } | null,
  formData: FormData,
): Promise<{ error: string } | null> {
  await requireAdmin();
  const r = await criarCliente({
    name: String(formData.get("name") ?? ""),
    phone: String(formData.get("phone") ?? ""),
    email: String(formData.get("email") ?? "") || undefined,
    birthDate: String(formData.get("birthDate") ?? "") || undefined,
    allergies: String(formData.get("allergies") ?? "") || undefined,
    notes: String(formData.get("notes") ?? "") || undefined,
    origem: String(formData.get("origem") ?? "") || undefined,
    whatsappOptIn: formData.get("whatsappOptIn") === "on",
  });
  if (!r.ok) return { error: r.message };
  revalidatePath("/admin/clientes");
  // Created OU já existente: abre a ficha (atualizar/ver) — sem beco sem saída.
  redirect(`/admin/clientes/${r.customer.id}`);
}

/**
 * Preview da mensagem de confirmação (feature 5) — usa o MESMO template do
 * Evolution (buildEventMessage), com o mesmo cálculo de início (TZ), para o
 * texto exibido ser idêntico ao que será enviado. Não envia nada.
 */
export async function previewBookingMessage(input: {
  nome: string;
  servico: string;
  date: string;
  time: string;
}): Promise<string | null> {
  await requireAdmin();
  const settings = await getSettings();
  const inicio = DateTime.fromISO(`${input.date}T${input.time}`, {
    zone: settings.timezone,
  });
  return buildEventMessage("booking_confirmation", {
    nome: input.nome,
    servico: input.servico,
    inicio: inicio.isValid ? inicio.toJSDate().toISOString() : undefined,
  });
}

/** Remove a foto de referência de um agendamento (LGPD — exclusão posterior). */
export async function adminDeleteBookingPhoto(
  formData: FormData,
): Promise<void> {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const b = await prisma.booking.findUnique({
    where: { id },
    select: { photoKey: true },
  });
  if (b?.photoKey) {
    await deletePrivatePhoto(b.photoKey);
    await prisma.booking.update({
      where: { id },
      data: { photoKey: null, photoConsentAt: null },
    });
  }
  refreshAgenda();
}

/**
 * Resultado das actions de agendamento chamadas programaticamente pelo cliente.
 * Erros de DOMÍNIO (slot ocupado, validação) são RETORNADOS — nunca lançados —
 * porque o Next apaga a mensagem de erro de server actions em produção. Assim a
 * mensagem amigável ("Esse horário já está ocupado…") chega de fato à tela.
 */
export type AdminBookingResult = { ok: true } | { ok: false; message: string };

export async function adminCreateManualBooking(
  formData: FormData,
): Promise<AdminBookingResult> {
  await requireAdmin();

  const source = String(formData.get("source") ?? "");
  if (source !== "admin_phone" && source !== "admin_whatsapp") {
    return {
      ok: false,
      message: "Informe como a cliente fechou (telefone ou WhatsApp).",
    };
  }
  const location = formData.get("location") === "home" ? "home" : "studio";

  const items = parseBookingItems(formData.get("items"));
  if (items.length === 0)
    return { ok: false, message: "Escolha ao menos um serviço." };

  // Foto de referência da cliente (opcional, LGPD): valida tipo/tamanho/consent
  // e processa ANTES de criar (falha cedo). Storage PRIVADO; nunca URL pública.
  const photo = formData.get("photo");
  let photoKey: string | null = null;
  if (photo instanceof File && photo.size > 0) {
    if (formData.get("photoConsent") !== "on") {
      return {
        ok: false,
        message: "Para anexar a foto, marque o consentimento da cliente.",
      };
    }
    if (!["image/jpeg", "image/png", "image/webp"].includes(photo.type)) {
      return { ok: false, message: "A foto deve ser JPG, PNG ou WebP." };
    }
    if (photo.size > MAX_BOOKING_PHOTO_BYTES) {
      return { ok: false, message: "Foto muito grande (máximo 5MB)." };
    }
    try {
      photoKey = await processPrivatePhoto(
        Buffer.from(await photo.arrayBuffer()),
      );
    } catch {
      return {
        ok: false,
        message: "Não consegui processar a imagem. Tente outra foto.",
      };
    }
  }

  const r = await createManualBooking({
    items,
    date: String(formData.get("date") ?? ""),
    time: String(formData.get("time") ?? ""),
    location,
    source,
    customerId: String(formData.get("customerId") ?? "") || undefined,
    customerName: String(formData.get("customerName") ?? "") || undefined,
    customerPhone: String(formData.get("customerPhone") ?? "") || undefined,
    anamnesis: anamnesisFrom(formData),
  });
  if (!r.ok) {
    if (photoKey) await deletePrivatePhoto(photoKey); // sem órfão no volume
    return { ok: false, message: r.message };
  }
  if (photoKey) {
    await prisma.booking.update({
      where: { id: r.id },
      data: { photoKey, photoConsentAt: new Date() },
    });
  }

  // "Avisar no WhatsApp": emite confirmação ao n8n (env-gated, idempotente por
  // booking). Sem N8N_WEBHOOK_URL nada é enviado — não simula.
  if (formData.get("notify") === "on") {
    const b = await prisma.booking.findUnique({
      where: { id: r.id },
      select: {
        startsAt: true,
        customer: { select: { name: true, phoneE164: true } },
        service: { select: { name: true } },
        items: {
          orderBy: { sort: "asc" },
          select: { service: { select: { name: true } } },
        },
      },
    });
    if (b) {
      // Multi-serviço: lista os nomes ("A + B"); fallback no serviço primário.
      const servico =
        b.items.length > 0
          ? b.items.map((i) => i.service.name).join(" + ")
          : b.service.name;
      await dispatchEvent({
        kind: "booking_confirmation",
        dedupKey: `booking_confirmation:${r.id}`,
        data: {
          nome: b.customer.name,
          telefone: b.customer.phoneE164,
          servico,
          inicio: b.startsAt.toISOString(),
        },
      });
    }
  }

  refreshAgenda();
  return { ok: true };
}

export async function adminRescheduleBooking(
  formData: FormData,
): Promise<AdminBookingResult> {
  await requireAdmin();
  const r = await rescheduleBooking(
    String(formData.get("id") ?? ""),
    String(formData.get("date") ?? ""),
    String(formData.get("time") ?? ""),
  );
  refreshAgenda();
  if (!r.ok) return { ok: false, message: r.message };
  return { ok: true };
}

// ── Serviços ────────────────────────────────────────────────────────────────

const reaisToCents = (v: FormDataEntryValue | null): number | null => {
  const raw = String(v ?? "").trim();
  if (!raw) return null;
  // Com vírgula ("1.250,00") o ponto é milhar; sem vírgula ("250.00") é decimal.
  const s = raw.includes(",") ? raw.replace(/\./g, "").replace(",", ".") : raw;
  const n = Number(s);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : null;
};

export async function adminUpdateService(formData: FormData): Promise<void> {
  await requireAdmin();

  const id = String(formData.get("id") ?? "");
  const service = await prisma.service.findUnique({ where: { id } });
  if (!service) fail("Serviço não encontrado.");

  const priceCents = reaisToCents(formData.get("price"));
  const priceHomeCents = reaisToCents(formData.get("priceHome"));
  const durationMin = Number(formData.get("durationMin"));
  const bufferMin = Number(formData.get("bufferMin"));
  if (
    priceCents == null ||
    !Number.isInteger(durationMin) ||
    durationMin <= 0
  ) {
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
      clubPoints: Math.max(
        0,
        Math.trunc(Number(formData.get("clubPoints")) || 0),
      ),
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
      clubPoints: Math.max(
        0,
        Math.trunc(Number(formData.get("clubPoints")) || 0),
      ),
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
      _count: {
        select: { bookings: true, eventSessions: true, waitlist: true },
      },
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

export async function adminSaveSettings(formData: FormData): Promise<void> {
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

export async function adminCreateBlock(formData: FormData): Promise<void> {
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
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
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

export async function adminUpdateUser(formData: FormData): Promise<void> {
  await requireAdmin();

  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  if (name.length < 2) fail("Informe o nome.");
  if (!EMAIL_RE.test(email)) fail("E-mail inválido.");

  const user = await prisma.adminUser.findUnique({ where: { id } });
  if (!user) fail("Conta não encontrada.");

  // Trocar e-mail: só se não colidir com outra conta.
  if (email !== user.email) {
    const exists = await prisma.adminUser.findUnique({ where: { email } });
    if (exists) fail("Já existe uma conta com esse e-mail.");
  }

  await prisma.adminUser.update({
    where: { id },
    data: { name, email },
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

export async function adminResetStrikes(customerId: string): Promise<void> {
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

  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
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
    data: {
      name,
      phoneE164: phone,
      email: email || null,
      birthDate,
      guardianName,
      guardianPhone,
    },
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

/**
 * CRM: tags, origem (captação), opt-in de WhatsApp (R3/LGPD) e etapa do funil
 * de noiva. Os scores RFV/LTV são calculados pelo job (não editáveis aqui).
 */
export async function adminUpdateCustomerCrm(
  formData: FormData,
): Promise<void> {
  await requireAdmin();

  const id = String(formData.get("id") ?? "");
  const customer = await prisma.customer.findUnique({ where: { id } });
  if (!customer) fail("Cliente não encontrada.");

  const tags = String(formData.get("tags") ?? "")
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
  const origem = String(formData.get("origem") ?? "").trim() || null;
  const optIn = formData.get("whatsappOptIn") === "on";
  const etapaRaw = String(formData.get("funilEtapa") ?? "");
  const funilEtapa = (Object.values(FunilEtapa) as string[]).includes(etapaRaw)
    ? (etapaRaw as FunilEtapa)
    : null;

  // F5: mudança de etapa do funil → registra transição (tempo por etapa) e
  // marca desde quando está na etapa nova (alerta de parada).
  const etapaMudou = funilEtapa !== customer.funilEtapa;
  if (etapaMudou) {
    await prisma.funilEvento
      .create({
        data: {
          customerId: id,
          de: customer.funilEtapa ?? null,
          para: funilEtapa ?? "saiu",
        },
      })
      .catch(() => {});
  }

  await prisma.customer.update({
    where: { id },
    data: {
      tags,
      origem,
      funilEtapa,
      ...(etapaMudou
        ? { funilEtapaDesde: funilEtapa ? new Date() : null }
        : {}),
      whatsappOptIn: optIn,
      // registra o 1º opt-in; mantém o histórico se já existia (LGPD)
      whatsappOptInAt:
        optIn && !customer.whatsappOptIn
          ? new Date()
          : customer.whatsappOptInAt,
    },
  });
  refreshFicha(id);
  revalidatePath("/admin/crm");
  revalidatePath("/admin/crm/funil");
}

// ── Jornadas (CRM — Pilar 3) ─────────────────────────────────────────────────

function refreshJornadas() {
  revalidatePath("/admin/crm/jornadas");
  revalidatePath("/admin/crm");
}

/** Liga/desliga uma jornada. Ligada = passa a enviar (com opt-in) no próximo cron. */
export async function adminToggleJornada(
  jornadaId: string,
  ativo: boolean,
): Promise<void> {
  await requireAdmin();
  await prisma.jornada.update({ where: { id: jornadaId }, data: { ativo } });
  refreshJornadas();
}

// Rascunhos sem emoji, voz da Mi — placeholders até a Mi aprovar (R20).
const JORNADAS_PADRAO: {
  nome: string;
  gatilho: string;
  descricao: string;
  template: string;
}[] = [
  {
    nome: "Boas-vindas",
    gatilho: "boas_vindas",
    descricao: "Após o 1º atendimento concluído. <!-- APROVAR COM A MI -->",
    template:
      "Que alegria ter você por aqui, {nome}! Obrigada pela confiança no seu primeiro cuidado comigo. Quando quiser marcar o próximo, é só me chamar por aqui.",
  },
  {
    nome: "Manutenção",
    gatilho: "manutencao",
    descricao:
      "Lembrete de recompra após um tempo sem voltar (cadência em business_settings). <!-- APROVAR COM A MI -->",
    template:
      "Oi, {nome}! Já faz um tempinho do seu {servico} — que tal reservarmos a sua manutenção? Me chama por aqui que a gente encontra o melhor horário.",
  },
  {
    nome: "Reativação",
    gatilho: "reativacao",
    descricao:
      "Para clientes em risco ou hibernando (segmento RFV). <!-- APROVAR COM A MI -->",
    template:
      "Oi, {nome}! Senti sua falta por aqui. Quando quiser reservar um cuidado só para você, é só me chamar — vou adorar te receber de novo.",
  },
];

/** Cria as jornadas padrão (DESATIVADAS) se ainda não houver nenhuma. */
export async function adminSeedJornadasPadrao(): Promise<void> {
  await requireAdmin();
  if ((await prisma.jornada.count()) > 0) {
    refreshJornadas();
    return;
  }
  for (const j of JORNADAS_PADRAO) {
    await prisma.jornada.create({
      data: {
        nome: j.nome,
        gatilho: j.gatilho,
        descricao: j.descricao,
        ativo: false,
        etapas: { create: { ordem: 1, esperaHoras: 0, template: j.template } },
      },
    });
  }
  refreshJornadas();
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

// ── Depoimentos (M12) ────────────────────────────────────────────────────────

function refreshDepoimentos() {
  revalidatePath("/admin/depoimentos");
  revalidatePath("/"); // a home exibe os depoimentos publicados
}

export async function adminCreateTestimonial(
  formData: FormData,
): Promise<void> {
  await requireAdmin();
  const quote = String(formData.get("quote") ?? "").trim();
  const author = String(formData.get("author") ?? "").trim();
  const sort = Number(formData.get("sort") ?? 0) || 0;
  if (quote.length < 5) fail("Escreva o depoimento.");
  if (author.length < 2) fail("Informe quem disse (ex.: Ana · madrinha).");

  // Depoimento criado pela Mi já nasce aprovado (status espelha `published`).
  await prisma.testimonial.create({
    data: { quote, author, sort, status: "aprovado", origem: "admin" },
  });
  refreshDepoimentos();
}

export async function adminUpdateTestimonial(
  formData: FormData,
): Promise<void> {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const quote = String(formData.get("quote") ?? "").trim();
  const author = String(formData.get("author") ?? "").trim();
  const sort = Number(formData.get("sort") ?? 0) || 0;
  if (quote.length < 5) fail("Escreva o depoimento.");
  if (author.length < 2) fail("Informe quem disse (ex.: Ana · madrinha).");

  const t = await prisma.testimonial.findUnique({ where: { id } });
  if (!t) fail("Depoimento não encontrado.");
  await prisma.testimonial.update({
    where: { id },
    data: { quote, author, sort },
  });
  refreshDepoimentos();
}

export async function adminToggleTestimonial(id: string): Promise<void> {
  await requireAdmin();
  const t = await prisma.testimonial.findUnique({ where: { id } });
  if (!t) fail("Depoimento não encontrado.");
  await prisma.testimonial.update({
    where: { id },
    // status espelha `published` (F1): despublicar arquiva, publicar aprova.
    data: {
      published: !t.published,
      status: !t.published ? "aprovado" : "arquivado",
    },
  });
  refreshDepoimentos();
}

export async function adminDeleteTestimonial(id: string): Promise<void> {
  await requireAdmin();
  await prisma.testimonial.delete({ where: { id } }).catch(() => null);
  refreshDepoimentos();
}

// ── Moderação de momentos (F3 — depoimentos enviados pelas clientes) ─────────

export async function adminAprovarMomento(formData: FormData): Promise<void> {
  const session = await requireAdmin();
  const { aprovarMomento } = await import("@/lib/momentos");
  await aprovarMomento(
    String(formData.get("id") ?? ""),
    session.user?.email ?? "admin",
  );
  refreshDepoimentos();
}

export async function adminRejeitarMomento(formData: FormData): Promise<void> {
  const session = await requireAdmin();
  const { rejeitarMomento } = await import("@/lib/momentos");
  await rejeitarMomento(
    String(formData.get("id") ?? ""),
    session.user?.email ?? "admin",
    String(formData.get("motivo") ?? ""),
  );
  refreshDepoimentos();
}

/** Aprova o texto mas oculta (ou volta a mostrar) uma foto específica. */
export async function adminToggleFotoMomento(
  formData: FormData,
): Promise<void> {
  await requireAdmin();
  const id = String(formData.get("fotoId") ?? "");
  const foto = await prisma.testimonialPhoto.findUnique({ where: { id } });
  if (!foto) fail("Foto não encontrada.");
  await prisma.testimonialPhoto.update({
    where: { id },
    data: { aprovada: !foto.aprovada },
  });
  refreshDepoimentos();
}

/** Destaque: aparece primeiro na vitrine pública. */
export async function adminToggleDestaqueMomento(id: string): Promise<void> {
  await requireAdmin();
  const t = await prisma.testimonial.findUnique({ where: { id } });
  if (!t) fail("Depoimento não encontrado.");
  await prisma.testimonial.update({
    where: { id },
    data: { destaque: !t.destaque },
  });
  refreshDepoimentos();
}

/** Arquiva um momento antigo (sai do site; a cliente vê como arquivado). */
export async function adminArquivarMomento(id: string): Promise<void> {
  await requireAdmin();
  await prisma.testimonial
    .update({
      where: { id },
      data: { status: "arquivado", published: false },
    })
    .catch(() => null);
  refreshDepoimentos();
}

// ── Disponibilidade por serviço (M9.5 — dias/horas próprios do dia a dia) ─────

const HHMM_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export async function adminAddServiceAvailability(
  formData: FormData,
): Promise<void> {
  await requireAdmin();
  const serviceId = String(formData.get("serviceId") ?? "");
  const weekday = Number(formData.get("weekday") ?? 0);
  const startTime = String(formData.get("startTime") ?? "").trim();
  const endTime = String(formData.get("endTime") ?? "").trim();
  if (weekday < 1 || weekday > 7) fail("Dia da semana inválido.");
  if (!HHMM_RE.test(startTime) || !HHMM_RE.test(endTime)) {
    fail("Use o formato HH:MM (ex.: 09:00).");
  }
  if (endTime <= startTime) fail("O fim precisa ser depois do início.");

  const svc = await prisma.service.findUnique({ where: { id: serviceId } });
  if (!svc) fail("Serviço não encontrado.");

  await prisma.serviceAvailability.create({
    data: { serviceId, weekday, startTime, endTime },
  });
  revalidatePath("/admin/servicos");
}

export async function adminRemoveServiceAvailability(
  id: string,
): Promise<void> {
  await requireAdmin();
  await prisma.serviceAvailability.delete({ where: { id } }).catch(() => null);
  revalidatePath("/admin/servicos");
}

// ── Clube por pontos: recompensas, config e operações (Anexo 1) ──────────────

const REWARD_TIPOS = ["premio", "servico"] as const;

export async function adminCreateReward(formData: FormData): Promise<void> {
  await requireAdmin();
  const nome = String(formData.get("nome") ?? "").trim();
  const tipo = String(formData.get("tipo") ?? "premio");
  const custoPontos = Math.trunc(Number(formData.get("custoPontos")) || 0);
  if (nome.length < 2) fail("Dê um nome à recompensa.");
  if (!REWARD_TIPOS.includes(tipo as never)) fail("Tipo inválido.");
  if (custoPontos <= 0) fail("O custo em pontos precisa ser maior que zero.");
  await prisma.clubReward.create({
    data: {
      nome,
      tipo,
      custoPontos,
      sort: Math.trunc(Number(formData.get("sort")) || 0),
    },
  });
  revalidatePath("/admin/clube");
}

export async function adminUpdateReward(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const nome = String(formData.get("nome") ?? "").trim();
  const tipo = String(formData.get("tipo") ?? "premio");
  const custoPontos = Math.trunc(Number(formData.get("custoPontos")) || 0);
  if (nome.length < 2) fail("Dê um nome à recompensa.");
  if (!REWARD_TIPOS.includes(tipo as never)) fail("Tipo inválido.");
  if (custoPontos <= 0) fail("O custo em pontos precisa ser maior que zero.");
  const r = await prisma.clubReward.findUnique({ where: { id } });
  if (!r) fail("Recompensa não encontrada.");
  await prisma.clubReward.update({
    where: { id },
    data: {
      nome,
      tipo,
      custoPontos,
      ativo: formData.get("ativo") === "on",
      sort: Math.trunc(Number(formData.get("sort")) || 0),
    },
  });
  revalidatePath("/admin/clube");
}

export async function adminDeleteReward(id: string): Promise<void> {
  await requireAdmin();
  await prisma.clubReward.delete({ where: { id } }).catch(() => null);
  revalidatePath("/admin/clube");
}

export async function adminSetPointsPerReferral(
  formData: FormData,
): Promise<void> {
  await requireAdmin();
  const valor = Math.max(0, Math.trunc(Number(formData.get("pontos")) || 0));
  await prisma.businessSetting.upsert({
    where: { key: "club_points_per_referral" },
    update: { value: valor },
    create: { key: "club_points_per_referral", value: valor },
  });
  invalidateSettingsCache();
  revalidatePath("/admin/clube");
}

/**
 * Regra de indicação PERCENTUAL (nova): a Mi define o % dos pontos da indicada
 * que a indicadora recebe, o escopo e liga/desliga o programa. Validação:
 * percentual em [0, 100] com decimais; mudança vale só para eventos futuros
 * (nunca recalcula créditos passados).
 */
export async function adminSetReferralRule(formData: FormData): Promise<void> {
  await requireAdmin();

  const bruto = Number(
    String(formData.get("percentual") ?? "").replace(",", "."),
  );
  if (!Number.isFinite(bruto) || bruto < 0 || bruto > 100) {
    fail("Percentual inválido — informe um número entre 0 e 100.");
  }
  // Normaliza a no máx. 2 casas decimais (ex.: 12.5).
  const percentual = Math.round(bruto * 100) / 100;

  const escopoRaw = String(formData.get("escopo") ?? "");
  const escopo =
    escopoRaw === "TODOS_ATENDIMENTOS"
      ? "TODOS_ATENDIMENTOS"
      : "PRIMEIRO_ATENDIMENTO";

  const ativo = formData.get("ativo") != null;

  await prisma.$transaction([
    prisma.businessSetting.upsert({
      where: { key: "club_referral_percent" },
      update: { value: percentual },
      create: { key: "club_referral_percent", value: percentual },
    }),
    prisma.businessSetting.upsert({
      where: { key: "club_referral_scope" },
      update: { value: escopo },
      create: { key: "club_referral_scope", value: escopo },
    }),
    prisma.businessSetting.upsert({
      where: { key: "club_referral_active" },
      update: { value: ativo },
      create: { key: "club_referral_active", value: ativo },
    }),
  ]);
  invalidateSettingsCache();
  revalidatePath("/admin/clube");
}

/** Pontos de engajamento (F5/Área da Cliente): depoimento, foto, reagendamento. */
export async function adminSetPointsEngajamento(
  formData: FormData,
): Promise<void> {
  await requireAdmin();
  const chaves = {
    depoimento: "club_points_depoimento",
    foto: "club_points_foto",
    reagendamento: "club_points_reagendamento",
  } as const;
  for (const [campo, key] of Object.entries(chaves)) {
    const valor = Math.max(0, Math.trunc(Number(formData.get(campo)) || 0));
    await prisma.businessSetting.upsert({
      where: { key },
      update: { value: valor },
      create: { key, value: valor },
    });
  }
  invalidateSettingsCache();
  revalidatePath("/admin/clube");
}

export async function adminAdjustPoints(formData: FormData): Promise<void> {
  await requireAdmin();
  const customerId = String(formData.get("customerId") ?? "");
  const pontos = Math.trunc(Number(formData.get("pontos")) || 0);
  const descricao = String(formData.get("descricao") ?? "").trim();
  if (pontos === 0)
    fail("Informe quantos pontos (positivo credita, negativo tira).");
  if (descricao.length < 2) fail("Diga o motivo do ajuste.");
  await ajustarPontosManual(customerId, pontos, descricao);
  revalidatePath(`/admin/clientes/${customerId}`);
}

export async function adminRedeemReward(formData: FormData): Promise<void> {
  await requireAdmin();
  const customerId = String(formData.get("customerId") ?? "");
  const rewardId = String(formData.get("rewardId") ?? "");
  const r = await resgatarRecompensa(customerId, rewardId);
  if (!r.ok) fail(r.message ?? "Não foi possível resgatar.");
  revalidatePath(`/admin/clientes/${customerId}`);
}

/** Mi marca um voucher de resgate como entregue. */
export async function adminMarkVoucherEntregue(id: string): Promise<void> {
  await requireAdmin();
  await marcarVoucherEntregue(id);
  revalidatePath("/admin/clube");
}

// ── Vitrine editável: pacotes e FAQs de noiva/debutante (Onda B) ─────────────

const CATEGORIAS_VITRINE = ["noiva", "debutante"] as const;

function refreshVitrines() {
  revalidatePath("/noivas");
  revalidatePath("/debutantes");
  revalidatePath("/admin/pacotes");
}

/** "linha1\nlinha2" → ["linha1","linha2"] (sem vazias). */
function linhas(v: FormDataEntryValue | null): string[] {
  return String(v ?? "")
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
}

export async function adminCreatePacote(formData: FormData): Promise<void> {
  await requireAdmin();
  const categoria = String(formData.get("categoria") ?? "");
  const nome = String(formData.get("nome") ?? "").trim();
  const preco = String(formData.get("preco") ?? "").trim();
  if (!CATEGORIAS_VITRINE.includes(categoria as never))
    fail("Categoria inválida.");
  if (nome.length < 2) fail("Dê um nome ao pacote.");
  if (!preco) fail("Informe o preço (texto livre, ex.: R$ 2.979).");
  await prisma.pacote.create({
    data: {
      categoria,
      nome,
      preco,
      parcela: String(formData.get("parcela") ?? "").trim() || null,
      itens: linhas(formData.get("itens")),
      rodape: String(formData.get("rodape") ?? "").trim() || null,
      destaque: formData.get("destaque") === "on",
      sort: Math.trunc(Number(formData.get("sort")) || 0),
    },
  });
  refreshVitrines();
}

export async function adminUpdatePacote(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const nome = String(formData.get("nome") ?? "").trim();
  const preco = String(formData.get("preco") ?? "").trim();
  if (nome.length < 2) fail("Dê um nome ao pacote.");
  if (!preco) fail("Informe o preço.");
  const p = await prisma.pacote.findUnique({ where: { id } });
  if (!p) fail("Pacote não encontrado.");
  await prisma.pacote.update({
    where: { id },
    data: {
      nome,
      preco,
      parcela: String(formData.get("parcela") ?? "").trim() || null,
      itens: linhas(formData.get("itens")),
      rodape: String(formData.get("rodape") ?? "").trim() || null,
      destaque: formData.get("destaque") === "on",
      ativo: formData.get("ativo") === "on",
      sort: Math.trunc(Number(formData.get("sort")) || 0),
    },
  });
  refreshVitrines();
}

export async function adminDeletePacote(id: string): Promise<void> {
  await requireAdmin();
  await prisma.pacote.delete({ where: { id } }).catch(() => null);
  refreshVitrines();
}

export async function adminCreateFaq(formData: FormData): Promise<void> {
  await requireAdmin();
  const categoria = String(formData.get("categoria") ?? "");
  const pergunta = String(formData.get("pergunta") ?? "").trim();
  const resposta = String(formData.get("resposta") ?? "").trim();
  if (!CATEGORIAS_VITRINE.includes(categoria as never))
    fail("Categoria inválida.");
  if (pergunta.length < 3 || resposta.length < 3)
    fail("Preencha pergunta e resposta.");
  await prisma.faq.create({
    data: {
      categoria,
      pergunta,
      resposta,
      sort: Math.trunc(Number(formData.get("sort")) || 0),
    },
  });
  refreshVitrines();
}

export async function adminUpdateFaq(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const pergunta = String(formData.get("pergunta") ?? "").trim();
  const resposta = String(formData.get("resposta") ?? "").trim();
  if (pergunta.length < 3 || resposta.length < 3)
    fail("Preencha pergunta e resposta.");
  const f = await prisma.faq.findUnique({ where: { id } });
  if (!f) fail("Pergunta não encontrada.");
  await prisma.faq.update({
    where: { id },
    data: {
      pergunta,
      resposta,
      ativo: formData.get("ativo") === "on",
      sort: Math.trunc(Number(formData.get("sort")) || 0),
    },
  });
  refreshVitrines();
}

export async function adminDeleteFaq(id: string): Promise<void> {
  await requireAdmin();
  await prisma.faq.delete({ where: { id } }).catch(() => null);
  refreshVitrines();
}

// ── CMS de textos (Onda B) ───────────────────────────────────────────────────

export async function adminSetContent(formData: FormData): Promise<void> {
  await requireAdmin();
  for (const f of CONTENT_FIELDS) {
    const raw = formData.get(f.key);
    if (raw === null) continue;
    const value = String(raw).trim();
    // Vazio ou igual ao padrão → remove o override (volta ao texto de fábrica).
    if (!value || value === f.default) {
      await prisma.siteContent
        .delete({ where: { key: f.key } })
        .catch(() => null);
    } else {
      await prisma.siteContent.upsert({
        where: { key: f.key },
        update: { value },
        create: { key: f.key, value },
      });
    }
  }
  invalidateContentCache();
  revalidatePath("/", "layout"); // textos aparecem em todas as páginas
}
