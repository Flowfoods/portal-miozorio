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
  if (rewardId) {
    const r = await resgatarRecompensa(s.customerId, rewardId);
    // O motor devolve mensagem pronta ("Saldo insuficiente para esse
    // resgate."), e ela era DESCARTADA: a cliente apertava Resgatar, a tela
    // piscava e voltava igual, sem saber se deu certo. Volta pela URL porque
    // o formulário vive num server component — sem virar client component só
    // para carregar um aviso.
    if (!r.ok) {
      revalidatePath("/clube/conta/clube");
      const msg = r.message ?? "Não consegui concluir agora. Tente de novo.";
      redirect(`/clube/conta/clube?erro=${encodeURIComponent(msg)}`);
    }
  }
  revalidatePath("/clube/conta"); // Início (resumo de pontos)
  revalidatePath("/clube/conta/clube"); // aba Clube (catálogo/vouchers/extrato)
  redirect("/clube/conta/clube?resgate=ok");
}
