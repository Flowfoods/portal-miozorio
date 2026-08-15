"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { normalizeE164BR } from "@/lib/phone";
import { ensureClubMember, OCASIOES_INDICACAO } from "@/lib/clube";

/**
 * Server actions PÚBLICAS do Clube (entrar no clube / ser indicada).
 * Validação dura aqui (a UI é só conveniência); telefone vira E.164 (R5);
 * LGPD: consentimento explícito obrigatório, registrado em lgpd_consent_at.
 * Honeypot "site" segura bot básico sem captcha (não atrapalha a cliente).
 */

export type ClubFormState = { error: string } | null;

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export async function joinClub(
  _prev: ClubFormState,
  formData: FormData,
): Promise<ClubFormState> {
  // Honeypot: humano não preenche campo invisível.
  if (String(formData.get("site") ?? "").trim()) redirect("/clube");

  const name = String(formData.get("name") ?? "").trim();
  if (name.length < 2) return { error: "Me conta seu nome? 💛" };

  const phone = normalizeE164BR(String(formData.get("phone") ?? ""));
  if (!phone) return { error: "Confere o WhatsApp? Use DDD + número." };

  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  if (email && !EMAIL_RE.test(email)) return { error: "E-mail inválido." };

  if (formData.get("lgpd") !== "on") {
    return { error: "Para entrar no clube, aceite a política de privacidade." };
  }

  const birthRaw = String(formData.get("birthDate") ?? "").trim();
  const birthDate = birthRaw ? new Date(`${birthRaw}T12:00:00Z`) : null;

  // Telefone já cadastrado: este formulário é público e não prova posse do
  // número. Antes ele fazia upsert (sobrescrevendo nome/e-mail/nascimento de
  // quem já existia), carimbava consentimento no lugar da titular e ainda
  // devolvia a carteirinha DELA no redirect. Quem já tem cadastro entra pelo
  // login — lá o telefone é verificado.
  const existente = await prisma.customer.findUnique({
    where: { phoneE164: phone },
    select: { id: true },
  });
  if (existente) redirect("/clube/entrar");

  const customer = await prisma.customer.create({
    data: {
      name,
      phoneE164: phone,
      email: email || null,
      birthDate,
      lgpdConsentAt: new Date(),
    },
  });

  await ensureClubMember(customer.id);
  // A carteirinha agora exige sessão (o código dela é público — é o link de
  // indicação). Manda para o login em vez de devolver a página que ela ainda
  // não pode ver.
  redirect("/clube/entrar");
}

export async function submitReferral(
  _prev: ClubFormState,
  formData: FormData,
): Promise<ClubFormState> {
  const codigo = String(formData.get("codigo") ?? "").trim();
  if (String(formData.get("site") ?? "").trim()) redirect(`/clube`);

  const embaixadora = await prisma.customer.findUnique({
    where: { referralCode: codigo },
  });
  if (!embaixadora?.clubJoinedAt) {
    return { error: "Esse link de indicação não está mais ativo." };
  }

  const name = String(formData.get("name") ?? "").trim();
  if (name.length < 2) return { error: "Me conta seu nome? 💛" };

  const phone = normalizeE164BR(String(formData.get("phone") ?? ""));
  if (!phone) return { error: "Confere o WhatsApp? Use DDD + número." };
  if (phone === embaixadora.phoneE164) {
    return { error: "Esse é o seu próprio número 💛 indique uma amiga!" };
  }

  const ocasiao = String(formData.get("ocasiao") ?? "").trim();
  if (!(OCASIOES_INDICACAO as readonly string[]).includes(ocasiao)) {
    return { error: "Escolha a ocasião." };
  }

  if (formData.get("lgpd") !== "on") {
    return { error: "Para continuar, aceite a política de privacidade." };
  }

  const alergia = String(formData.get("alergia") ?? "").trim();
  const referencia = String(formData.get("referencia") ?? "").trim();
  const interesse = [
    `Ocasião: ${ocasiao}`,
    referencia ? `Referência: ${referencia}` : "",
  ]
    .filter(Boolean)
    .join(" · ");

  const existente = await prisma.customer.findUnique({
    where: { phoneE164: phone },
    include: {
      _count: { select: { bookings: { where: { status: "completed" } } } },
    },
  });

  if (!existente) {
    await prisma.customer.create({
      data: {
        name,
        phoneE164: phone,
        referredById: embaixadora.id,
        clubInterest: interesse,
        allergies: alergia || null,
        lgpdConsentAt: new Date(),
      },
    });
  } else {
    // Anti-abuso: indicação só "pega" em quem ainda não é cliente de fato
    // (sem atendimento realizado) e ainda não tem madrinha registrada.
    const podeVincular =
      !existente.referredById && existente._count.bookings === 0;
    await prisma.customer.update({
      where: { id: existente.id },
      data: {
        ...(podeVincular ? { referredById: embaixadora.id } : {}),
        clubInterest: interesse,
        // Alergia da indicada nunca sobrescreve o que a Mi já anotou (M11).
        ...(alergia && !existente.allergies ? { allergies: alergia } : {}),
        // Consentimento NÃO é carimbado aqui: este formulário é público e não
        // prova posse do telefone. Registrar aceite em nome de uma titular que
        // não o deu é pior do que não registrar — o aceite dela vem quando ela
        // mesma agendar ou entrar no clube.
      },
    });
  }

  redirect(`/indicar/${codigo}/obrigada`);
}
