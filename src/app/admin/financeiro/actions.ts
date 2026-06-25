"use server";

import { revalidatePath } from "next/cache";
import { DateTime } from "luxon";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import {
  ATTACHMENT_MIME,
  MAX_ATTACHMENT_BYTES,
  saveAttachmentFile,
  deletePrivateAttachment,
} from "@/lib/media";

/**
 * Server actions do módulo Financeiro. Todas exigem sessão (requireAdmin —
 * defesa em profundidade junto do middleware). Soft-delete (active=false):
 * nunca apaga histórico financeiro. Valores em centavos; datas em UTC.
 */

function fail(message: string): never {
  throw new Error(message);
}

function refresh() {
  revalidatePath("/admin/financeiro");
  revalidatePath("/admin/financeiro/custos");
  revalidatePath("/admin/financeiro/receitas");
  revalidatePath("/admin/financeiro/categorias");
  revalidatePath("/admin/financeiro/recorrentes");
}

const PAYMENT_METHODS = ["pix", "cartao", "dinheiro", "boleto"] as const;

function payment(v: FormDataEntryValue | null): string | null {
  const s = String(v ?? "").trim();
  return (PAYMENT_METHODS as readonly string[]).includes(s) ? s : null;
}

/** "1.250,00" | "250.00" | "250" → centavos (Int). null se inválido. */
function reaisToCents(v: FormDataEntryValue | null): number | null {
  const raw = String(v ?? "").trim();
  if (!raw) return null;
  const s = raw.includes(",")
    ? raw.replace(/\./g, "").replace(",", ".")
    : raw;
  const n = Number(s);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : null;
}

/** "YYYY-MM-DD" → DATE em UTC-meia-noite (competência). null se vazio/ inválido. */
function competenceDate(v: FormDataEntryValue | null): Date | null {
  const s = String(v ?? "").trim();
  if (!s) return null;
  const d = DateTime.fromISO(s, { zone: "utc" }).startOf("day");
  return d.isValid ? d.toJSDate() : null;
}

/** "YYYY-MM-DD" → instante (caixa) à meia-noite no fuso do negócio. */
async function cashInstant(v: FormDataEntryValue | null): Promise<Date | null> {
  const s = String(v ?? "").trim();
  if (!s) return null;
  const { timezone } = await getSettings();
  const d = DateTime.fromISO(s, { zone: timezone }).startOf("day");
  return d.isValid ? d.toJSDate() : null;
}

/** Valida e grava um anexo opcional do form. Retorna os dados ou null. */
async function takeAttachment(formData: FormData): Promise<{
  filePath: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
} | null> {
  const file = formData.get("attachment");
  if (!(file instanceof File) || file.size === 0) return null;
  if (!ATTACHMENT_MIME[file.type]) {
    fail("O comprovante deve ser PDF, JPG, PNG ou WebP.");
  }
  if (file.size > MAX_ATTACHMENT_BYTES) {
    fail("Comprovante muito grande (máximo 12MB).");
  }
  const filePath = await saveAttachmentFile(
    Buffer.from(await file.arrayBuffer()),
    file.type,
  );
  return {
    filePath,
    fileName: file.name.slice(0, 200),
    mimeType: file.type,
    sizeBytes: file.size,
  };
}

// ── Despesas ─────────────────────────────────────────────────────────────────

export async function adminCreateExpense(formData: FormData): Promise<void> {
  await requireAdmin();

  const categoryId = String(formData.get("categoryId") ?? "");
  const category = await prisma.financialCategory.findUnique({
    where: { id: categoryId },
  });
  if (!category || category.kind !== "expense") {
    fail("Escolha uma categoria de despesa.");
  }

  const description = String(formData.get("description") ?? "").trim();
  if (description.length < 2) fail("Descreva a despesa.");

  const amountCents = reaisToCents(formData.get("amount"));
  if (amountCents == null || amountCents <= 0) fail("Valor inválido.");

  const competence = competenceDate(formData.get("competenceDate"));
  if (!competence) fail("Informe a data de competência.");

  const att = await takeAttachment(formData);

  await prisma.expense.create({
    data: {
      categoryId,
      description,
      amountCents,
      competenceDate: competence,
      paidAt: await cashInstant(formData.get("paidAt")),
      paymentMethod: payment(formData.get("paymentMethod")),
      supplier: String(formData.get("supplier") ?? "").trim() || null,
      isRecurring: formData.get("isRecurring") === "on",
      notes: String(formData.get("notes") ?? "").trim() || null,
      ...(att ? { attachments: { create: att } } : {}),
    },
  });
  refresh();
}

export async function adminUpdateExpense(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const expense = await prisma.expense.findUnique({ where: { id } });
  if (!expense) fail("Despesa não encontrada.");

  const amountCents = reaisToCents(formData.get("amount"));
  const competence = competenceDate(formData.get("competenceDate"));
  if (amountCents == null || amountCents <= 0) fail("Valor inválido.");
  if (!competence) fail("Data de competência inválida.");

  const att = await takeAttachment(formData);

  await prisma.expense.update({
    where: { id },
    data: {
      description: String(formData.get("description") ?? "").trim(),
      amountCents,
      competenceDate: competence,
      paidAt: await cashInstant(formData.get("paidAt")),
      paymentMethod: payment(formData.get("paymentMethod")),
      supplier: String(formData.get("supplier") ?? "").trim() || null,
      notes: String(formData.get("notes") ?? "").trim() || null,
      ...(att ? { attachments: { create: att } } : {}),
    },
  });
  refresh();
}

/** Soft-delete (R financeiro 4): nunca apaga histórico. */
export async function adminDeleteExpense(id: string): Promise<void> {
  await requireAdmin();
  await prisma.expense.update({ where: { id }, data: { active: false } });
  refresh();
}

// ── Receitas (manuais) ───────────────────────────────────────────────────────

export async function adminCreateRevenue(formData: FormData): Promise<void> {
  await requireAdmin();

  const description = String(formData.get("description") ?? "").trim();
  if (description.length < 2) fail("Descreva a receita.");

  const amountCents = reaisToCents(formData.get("amount"));
  if (amountCents == null || amountCents <= 0) fail("Valor inválido.");

  const competence = competenceDate(formData.get("competenceDate"));
  if (!competence) fail("Informe a data do evento/serviço (competência).");

  const categoryId = String(formData.get("categoryId") ?? "") || null;
  if (categoryId) {
    const cat = await prisma.financialCategory.findUnique({
      where: { id: categoryId },
    });
    if (!cat || cat.kind !== "revenue") fail("Categoria de receita inválida.");
  }

  const att = await takeAttachment(formData);

  await prisma.revenueEntry.create({
    data: {
      categoryId,
      description,
      amountCents,
      competenceDate: competence,
      receivedAt: await cashInstant(formData.get("receivedAt")),
      source: "manual",
      customerName: String(formData.get("customerName") ?? "").trim() || null,
      paymentMethod: payment(formData.get("paymentMethod")),
      cardFeeCents: reaisToCents(formData.get("cardFee")),
      ...(att ? { attachments: { create: att } } : {}),
    },
  });
  refresh();
}

export async function adminUpdateRevenue(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const entry = await prisma.revenueEntry.findUnique({ where: { id } });
  if (!entry) fail("Receita não encontrada.");

  const amountCents = reaisToCents(formData.get("amount"));
  const competence = competenceDate(formData.get("competenceDate"));
  if (amountCents == null || amountCents <= 0) fail("Valor inválido.");
  if (!competence) fail("Data de competência inválida.");

  const categoryId = String(formData.get("categoryId") ?? "") || null;
  const att = await takeAttachment(formData);

  await prisma.revenueEntry.update({
    where: { id },
    data: {
      categoryId,
      description: String(formData.get("description") ?? "").trim(),
      amountCents,
      competenceDate: competence,
      receivedAt: await cashInstant(formData.get("receivedAt")),
      customerName: String(formData.get("customerName") ?? "").trim() || null,
      paymentMethod: payment(formData.get("paymentMethod")),
      cardFeeCents: reaisToCents(formData.get("cardFee")),
      ...(att ? { attachments: { create: att } } : {}),
    },
  });
  refresh();
}

export async function adminDeleteRevenue(id: string): Promise<void> {
  await requireAdmin();
  await prisma.revenueEntry.update({ where: { id }, data: { active: false } });
  refresh();
}

// ── Categorias ───────────────────────────────────────────────────────────────

const NATURES = ["fixed", "variable"] as const;
const DRE_GROUPS = [
  "deducao_venda",
  "custo_variavel",
  "custo_fixo",
  "pro_labore",
] as const;

function slugify(name: string): string {
  return (
    name
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "categoria"
  );
}

export async function adminCreateCategory(formData: FormData): Promise<void> {
  await requireAdmin();
  const name = String(formData.get("name") ?? "").trim();
  if (name.length < 2) fail("Dê um nome à categoria.");
  const kind = formData.get("kind") === "revenue" ? "revenue" : "expense";

  let nature: (typeof NATURES)[number] | null = null;
  let dreGroup: (typeof DRE_GROUPS)[number] | null = null;
  if (kind === "expense") {
    const n = String(formData.get("nature") ?? "");
    const g = String(formData.get("dreGroup") ?? "");
    if (!(NATURES as readonly string[]).includes(n)) fail("Escolha fixo ou variável.");
    if (!(DRE_GROUPS as readonly string[]).includes(g)) fail("Escolha a linha do DRE.");
    nature = n as (typeof NATURES)[number];
    dreGroup = g as (typeof DRE_GROUPS)[number];
  }

  // code único (slug + sufixo se colidir)
  const base = `${kind === "revenue" ? "rev" : "exp"}-${slugify(name)}`;
  let code = base;
  for (let i = 2; await prisma.financialCategory.findUnique({ where: { code } }); i++) {
    code = `${base}-${i}`;
  }

  await prisma.financialCategory.create({
    data: {
      code,
      name,
      kind,
      nature,
      dreGroup,
      isCmv: kind === "expense" && formData.get("isCmv") === "on",
      color: String(formData.get("color") ?? "").trim() || "#8A7361",
    },
  });
  refresh();
}

export async function adminUpdateCategory(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const cat = await prisma.financialCategory.findUnique({ where: { id } });
  if (!cat) fail("Categoria não encontrada.");

  await prisma.financialCategory.update({
    where: { id },
    data: {
      name: String(formData.get("name") ?? "").trim() || cat.name,
      color: String(formData.get("color") ?? "").trim() || cat.color,
      isCmv: cat.kind === "expense" && formData.get("isCmv") === "on",
      active: formData.get("active") === "on",
      ...(cat.kind === "expense"
        ? {
            nature: (NATURES as readonly string[]).includes(
              String(formData.get("nature")),
            )
              ? (String(formData.get("nature")) as (typeof NATURES)[number])
              : cat.nature,
            dreGroup: (DRE_GROUPS as readonly string[]).includes(
              String(formData.get("dreGroup")),
            )
              ? (String(formData.get("dreGroup")) as (typeof DRE_GROUPS)[number])
              : cat.dreGroup,
          }
        : {}),
    },
  });
  refresh();
}

// ── Custos recorrentes ───────────────────────────────────────────────────────

export async function adminCreateRecurring(formData: FormData): Promise<void> {
  await requireAdmin();
  const categoryId = String(formData.get("categoryId") ?? "");
  const cat = await prisma.financialCategory.findUnique({
    where: { id: categoryId },
  });
  if (!cat || cat.kind !== "expense") fail("Escolha uma categoria de despesa.");

  const description = String(formData.get("description") ?? "").trim();
  if (description.length < 2) fail("Descreva o custo recorrente.");
  const amountCents = reaisToCents(formData.get("amount"));
  if (amountCents == null || amountCents <= 0) fail("Valor inválido.");
  const dayOfMonth = Number(formData.get("dayOfMonth"));
  if (!Number.isInteger(dayOfMonth) || dayOfMonth < 1 || dayOfMonth > 28) {
    fail("Dia de vencimento deve ser entre 1 e 28.");
  }

  await prisma.recurringCost.create({
    data: {
      categoryId,
      description,
      amountCents,
      dayOfMonth,
      paymentMethod: payment(formData.get("paymentMethod")),
      supplier: String(formData.get("supplier") ?? "").trim() || null,
    },
  });
  refresh();
}

export async function adminToggleRecurring(id: string): Promise<void> {
  await requireAdmin();
  const r = await prisma.recurringCost.findUnique({ where: { id } });
  if (!r) fail("Custo recorrente não encontrado.");
  await prisma.recurringCost.update({
    where: { id },
    data: { active: !r.active },
  });
  refresh();
}

// ── Anexos ───────────────────────────────────────────────────────────────────

export async function adminDeleteAttachment(id: string): Promise<void> {
  await requireAdmin();
  const att = await prisma.attachment.findUnique({ where: { id } });
  if (!att) return;
  await prisma.attachment.delete({ where: { id } });
  await deletePrivateAttachment(att.filePath);
  refresh();
}
