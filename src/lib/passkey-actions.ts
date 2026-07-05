"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { sujeitoAtual } from "@/lib/passkeys";
import type { Area } from "@/lib/webauthn";

/**
 * Gerência de passkeys (Auth F3). Ownership: a passkey só é tocada se pertencer
 * ao sujeito da sessão ATUAL da mesma área — nunca por id solto do cliente.
 */
async function donoOuNull(id: string) {
  const pk = await prisma.passkey.findUnique({ where: { id } });
  if (!pk) return null;
  const suj = await sujeitoAtual(pk.area as Area);
  if (!suj || suj.subjectId !== pk.subjectId) return null;
  return pk;
}

function revalidar(area: string) {
  revalidatePath(area === "admin" ? "/admin/config" : "/clube/conta/perfil");
}

export async function removerPasskeyAction(id: string): Promise<void> {
  const pk = await donoOuNull(id);
  if (!pk) return;
  await prisma.passkey.delete({ where: { id } });
  revalidar(pk.area);
}

export async function renomearPasskeyAction(
  id: string,
  nome: string,
): Promise<void> {
  const pk = await donoOuNull(id);
  if (!pk) return;
  const limpo = nome.trim().slice(0, 60);
  await prisma.passkey.update({
    where: { id },
    data: { deviceName: limpo || pk.deviceName },
  });
  revalidar(pk.area);
}
