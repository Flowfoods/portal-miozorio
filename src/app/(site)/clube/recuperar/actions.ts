"use server";

import { redirect } from "next/navigation";
import {
  solicitarRecuperacao,
  validarCodigo,
  redefinirSenhaComVale,
} from "@/lib/cliente-recuperacao";

/**
 * Fluxo de recuperação de senha da cliente (Auth F2.2), em 3 passos. Respostas
 * neutras (nunca revelam se o telefone existe). O passo 1 sempre "dá certo" na
 * UI — a existência da conta não vaza.
 */

export type PedirState = { ok: true; phone: string } | { error: string } | null;

export async function pedirCodigoAction(
  _prev: PedirState,
  formData: FormData,
): Promise<PedirState> {
  const phone = String(formData.get("phone") ?? "").trim();
  if (!phone) return { error: "Digite seu WhatsApp." };
  await solicitarRecuperacao(phone);
  return { ok: true, phone }; // neutro
}

export type ValidarState = { ok: true } | { error: string } | null;

export async function validarCodigoAction(
  _prev: ValidarState,
  formData: FormData,
): Promise<ValidarState> {
  const r = await validarCodigo(
    String(formData.get("phone") ?? ""),
    String(formData.get("code") ?? ""),
  );
  return r.ok ? { ok: true } : { error: r.message };
}

export type SenhaState = { error: string } | null;

export async function trocarSenhaAction(
  _prev: SenhaState,
  formData: FormData,
): Promise<SenhaState> {
  const r = await redefinirSenhaComVale(String(formData.get("password") ?? ""));
  if (!r.ok) return { error: r.message };
  redirect("/clube/conta");
}
