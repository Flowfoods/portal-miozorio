"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  loginCliente,
  setClientePassword,
  logoutCliente,
  getClienteSession,
} from "@/lib/cliente-auth";
import { resgatarRecompensa } from "@/lib/clube-pontos";

/** Estado dos forms do portal do cliente (erro inline). */
export type ClienteFormState = { error: string } | null;

export async function entrarAction(
  _prev: ClienteFormState,
  formData: FormData,
): Promise<ClienteFormState> {
  const r = await loginCliente(
    String(formData.get("phone") ?? ""),
    String(formData.get("password") ?? ""),
  );
  if (!r.ok) return { error: r.message };
  redirect(r.mustChange ? "/clube/conta/senha" : "/clube/conta");
}

export async function definirSenhaAction(
  _prev: ClienteFormState,
  formData: FormData,
): Promise<ClienteFormState> {
  const r = await setClientePassword(
    String(formData.get("password") ?? ""),
    formData.get("consent") === "on",
  );
  if (!r.ok) return { error: r.message };
  redirect("/clube/conta");
}

export async function sairAction(): Promise<void> {
  logoutCliente();
  redirect("/clube/entrar");
}

/**
 * Resgate self-service. Isolamento: o customerId vem da SESSÃO, nunca do form
 * (o form só traz o rewardId). O débito/saldo é transacional no motor.
 */
export async function resgatarAction(formData: FormData): Promise<void> {
  const s = getClienteSession();
  if (!s || s.prov) redirect("/clube/entrar");
  const rewardId = String(formData.get("rewardId") ?? "");
  if (rewardId) await resgatarRecompensa(s.customerId, rewardId);
  revalidatePath("/clube/conta");
}
