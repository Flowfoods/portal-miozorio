"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import {
  MIN_SENHA,
  SENHA_CURTA,
  RESET_TTL_MS,
  generateResetToken,
  hashResetToken,
  senhaFraca,
} from "@/lib/security";
import { sendPasswordChangedEmail, sendPasswordResetEmail } from "@/lib/email";
import { metaFromHeaders, recordAuth } from "@/lib/authlog";

/**
 * Fluxo PÚBLICO de redefinição de senha do painel (M13.4).
 * Anti-enumeração: a resposta do pedido é sempre neutra, exista ou não a conta.
 * O token cru só viaja no e-mail; no banco fica apenas o SHA-256, com validade
 * de 1h e uso único. Concluir o reset também destrava a conta (M13.2).
 */

export type ResetState = { error: string } | { ok: string } | null;

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const NEUTRO =
  "Se houver uma conta com esse e-mail, enviamos um link para redefinir a senha.";

export async function requestPasswordReset(
  _prev: ResetState,
  formData: FormData,
): Promise<ResetState> {
  // Honeypot: humano não preenche campo invisível.
  if (String(formData.get("site") ?? "").trim()) return { ok: NEUTRO };

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!EMAIL_RE.test(email)) return { error: "E-mail inválido." };

  await recordAuth("admin", "reset_request", email, metaFromHeaders(headers()));

  const user = await prisma.adminUser.findUnique({ where: { email } });
  if (user && user.active) {
    // Invalida links anteriores ainda não usados desta conta.
    await prisma.passwordResetToken.updateMany({
      where: { adminUserId: user.id, usedAt: null },
      data: { usedAt: new Date() },
    });

    const raw = generateResetToken();
    await prisma.passwordResetToken.create({
      data: {
        adminUserId: user.id,
        tokenHash: hashResetToken(raw),
        expiresAt: new Date(Date.now() + RESET_TTL_MS),
      },
    });

    const base = process.env.NEXT_PUBLIC_SITE_URL ?? "https://miozorio.com.br";
    const link = `${base}/admin/redefinir/${raw}`;
    try {
      await sendPasswordResetEmail(email, link);
    } catch (e) {
      // Não revela falha ao usuário (anti-enumeração); fica no log do servidor.
      console.error("reset: falha ao enviar e-mail", e);
    }
  }

  return { ok: NEUTRO };
}

export async function completePasswordReset(
  _prev: ResetState,
  formData: FormData,
): Promise<ResetState> {
  const token = String(formData.get("token") ?? "");
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  if (password.length < MIN_SENHA) return { error: SENHA_CURTA };
  if (senhaFraca(password))
    return { error: "Essa senha é fácil de adivinhar. Escolha outra mais forte." };
  if (password !== confirm) return { error: "As senhas não conferem." };

  const row = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: hashResetToken(token) },
  });
  if (!row || row.usedAt || row.expiresAt < new Date()) {
    return { error: "Esse link expirou ou já foi usado. Peça um novo." };
  }

  const [conta] = await prisma.$transaction([
    prisma.adminUser.update({
      where: { id: row.adminUserId },
      data: {
        passwordHash: bcrypt.hashSync(password, 12),
        // Concluir o reset destrava a conta (M13.2)…
        failedAttempts: 0,
        lockedUntil: null,
        // …e invalida TODAS as sessões JWT antigas (Auth F1.2).
        tokenVersion: { increment: 1 },
      },
      select: { email: true },
    }),
    prisma.passwordResetToken.update({
      where: { id: row.id },
      data: { usedAt: new Date() },
    }),
    // Qualquer outro link pendente da mesma conta morre junto.
    prisma.passwordResetToken.updateMany({
      where: { adminUserId: row.adminUserId, usedAt: null },
      data: { usedAt: new Date() },
    }),
  ]);

  await recordAuth(
    "admin",
    "reset_done",
    conta.email,
    metaFromHeaders(headers()),
  );
  // Aviso "sua senha foi alterada" (best-effort, não bloqueia o fluxo).
  try {
    await sendPasswordChangedEmail(conta.email);
  } catch (e) {
    console.error("reset: falha ao avisar troca de senha", e);
  }

  redirect("/admin/login?reset=ok");
}
