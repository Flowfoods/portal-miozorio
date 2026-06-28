"use server";

import { redirect } from "next/navigation";
import {
  loginCliente,
  setClientePassword,
  logoutCliente,
} from "@/lib/cliente-auth";

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
