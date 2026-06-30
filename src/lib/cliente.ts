import type { Customer } from "@prisma/client";
import { prisma } from "./prisma";
import { normalizeE164BR } from "./phone";
import { ensureClubMember } from "./clube";

/**
 * Serviço ÚNICO de onboarding de cliente (paridade de benefícios). Qualquer
 * caminho que cria cliente "do zero" (cadastro manual, cadastro rápido do
 * encaixe, importação) passa por AQUI — assim ninguém "esquece" de ativar
 * benefício. O primitivo que concede os benefícios do Clube (entrada + código
 * de indicação + acesso ao portal com senha provisória = telefone) é o
 * `ensureClubMember`, já chamado também pelo fluxo de agendamento (createBooking)
 * — garantindo que cliente manual e cliente do site sejam indistinguíveis.
 *
 * Dedupe por telefone E.164 (R3): se já existe, devolve a existente (existed),
 * nunca duplica. CRM (RFV/tags/funil) é derivado/calculado igual p/ todas.
 */

export interface CriarClienteInput {
  name: string;
  phone: string;
  email?: string;
  birthDate?: string; // YYYY-MM-DD
  allergies?: string;
  notes?: string;
  origem?: string; // captação: indicação, instagram, presencial…
  whatsappOptIn?: boolean; // consentimento de comunicação
}

export type CriarClienteResult =
  | { ok: true; existed: boolean; customer: Customer }
  | { ok: false; code: "invalid_name" | "invalid_phone"; message: string };

export async function criarCliente(
  input: CriarClienteInput,
): Promise<CriarClienteResult> {
  const name = input.name.trim();
  if (name.length < 2) {
    return { ok: false, code: "invalid_name", message: "Informe o nome da cliente." };
  }
  const phoneE164 = normalizeE164BR(input.phone);
  if (!phoneE164) {
    return {
      ok: false,
      code: "invalid_phone",
      message: "WhatsApp inválido — use DDD + número.",
    };
  }

  // Dedupe: uma pessoa = um registro. Já existe → devolve, não duplica.
  const existing = await prisma.customer.findUnique({ where: { phoneE164 } });
  if (existing) {
    await ensureClubMember(existing.id).catch(() => null); // garante benefícios mesmo em legado
    return { ok: true, existed: true, customer: existing };
  }

  const email = input.email?.trim().toLowerCase() || null;
  const birthDate = input.birthDate?.trim()
    ? new Date(`${input.birthDate}T12:00:00Z`)
    : null;
  const optIn = input.whatsappOptIn === true;

  const customer = await prisma.customer.create({
    data: {
      name,
      phoneE164,
      email,
      birthDate: birthDate && !Number.isNaN(birthDate.getTime()) ? birthDate : null,
      allergies: input.allergies?.trim() || null,
      notes: input.notes?.trim() || null,
      origem: input.origem?.trim() || null,
      whatsappOptIn: optIn,
      whatsappOptInAt: optIn ? new Date() : null,
      lgpdConsentAt: new Date(), // consentimento registrado na criação (LGPD)
    },
  });

  // Onboarding do Clube (mesmo primitivo do fluxo de agendamento).
  await ensureClubMember(customer.id).catch(() => null);

  return { ok: true, existed: false, customer };
}
