"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import bcrypt from "bcryptjs";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { MIN_SENHA, SENHA_CURTA, senhaFraca } from "@/lib/security";
import { metaFromHeaders, recordAuth } from "@/lib/authlog";
import { sendPasswordChangedEmail } from "@/lib/email";

/**
 * Conta do admin logado (Auth F4.3): trocar a própria senha (pedindo a atual) e
 * "sair de todos os dispositivos". As duas sobem o token_version — ou seja,
 * derrubam TODAS as sessões (inclusive a atual), então o admin faz login de novo.
 */
export type ContaState = { error: string } | { ok: string } | null;

export async function trocarSenhaAdminAction(
  _prev: ContaState,
  formData: FormData,
): Promise<ContaState> {
  const session = await requireAdmin();
  const email = session.user!.email!;
  const atual = String(formData.get("atual") ?? "");
  const nova = String(formData.get("nova") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (nova.length < MIN_SENHA) return { error: SENHA_CURTA };
  if (senhaFraca(nova))
    return { error: "Essa senha é fácil de adivinhar. Escolha outra." };
  if (nova !== confirm) return { error: "As senhas não conferem." };

  const u = await prisma.adminUser.findUnique({ where: { email } });
  if (!u || !bcrypt.compareSync(atual, u.passwordHash)) {
    return { error: "Senha atual incorreta." };
  }

  await prisma.adminUser.update({
    where: { id: u.id },
    data: {
      passwordHash: bcrypt.hashSync(nova, 12),
      // Invalida todas as sessões antigas (Auth F1.2).
      tokenVersion: { increment: 1 },
    },
  });
  await recordAuth("admin", "password_changed", email, metaFromHeaders(headers()));
  try {
    await sendPasswordChangedEmail(email);
  } catch {
    /* best-effort */
  }
  return { ok: "Senha alterada. Entre de novo com a nova senha." };
}

export async function sairDeTodosAction(): Promise<void> {
  const session = await requireAdmin();
  await prisma.adminUser.updateMany({
    where: { email: session.user!.email! },
    data: { tokenVersion: { increment: 1 } },
  });
  redirect("/admin/login");
}
