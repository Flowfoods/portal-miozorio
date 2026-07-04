"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getClienteSession } from "@/lib/cliente-auth";
import {
  enviarMomento,
  editarMomento,
  excluirMomento,
  MOMENTO_MAX_FOTOS,
} from "@/lib/momentos";
import type { ClienteFormState } from "../actions";

/** Converte os File do form em buffers (só arquivos reais, até o limite). */
async function lerFotos(
  formData: FormData,
): Promise<{ buffer: Buffer; mimeType: string }[]> {
  const files = formData
    .getAll("fotos")
    .filter((f): f is File => f instanceof File && f.size > 0)
    .slice(0, MOMENTO_MAX_FOTOS);
  const out: { buffer: Buffer; mimeType: string }[] = [];
  for (const f of files) {
    out.push({ buffer: Buffer.from(await f.arrayBuffer()), mimeType: f.type });
  }
  return out;
}

function lerRating(formData: FormData): number | null {
  const raw = String(formData.get("rating") ?? "").trim();
  if (!raw) return null;
  const n = Number(raw);
  return Number.isInteger(n) ? n : null;
}

export async function enviarMomentoAction(
  _prev: ClienteFormState,
  formData: FormData,
): Promise<ClienteFormState> {
  const s = getClienteSession();
  if (!s || s.prov) redirect("/clube/entrar");

  const r = await enviarMomento({
    customerId: s.customerId,
    texto: String(formData.get("texto") ?? ""),
    rating: lerRating(formData),
    bookingId: String(formData.get("bookingId") ?? "") || null,
    fotos: await lerFotos(formData),
    consentiu: formData.get("consent") === "on",
  });
  if (!r.ok) return { error: r.message };

  revalidatePath("/clube/conta/momentos");
  redirect("/clube/conta/momentos?enviado=1");
}

export async function editarMomentoAction(
  _prev: ClienteFormState,
  formData: FormData,
): Promise<ClienteFormState> {
  const s = getClienteSession();
  if (!s || s.prov) redirect("/clube/entrar");

  const r = await editarMomento({
    customerId: s.customerId,
    testimonialId: String(formData.get("id") ?? ""),
    texto: String(formData.get("texto") ?? ""),
    rating: lerRating(formData),
    removerFotoIds: formData.getAll("removerFoto").map(String),
    novasFotos: await lerFotos(formData),
  });
  if (!r.ok) return { error: r.message };

  revalidatePath("/clube/conta/momentos");
  redirect("/clube/conta/momentos?editado=1");
}

export async function excluirMomentoAction(formData: FormData): Promise<void> {
  const s = getClienteSession();
  if (!s || s.prov) redirect("/clube/entrar");

  await excluirMomento(s.customerId, String(formData.get("id") ?? ""));
  revalidatePath("/clube/conta/momentos");
  redirect("/clube/conta/momentos");
}
