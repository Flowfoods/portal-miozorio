"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { tentarEnviar } from "@/lib/whatsapp/service";

/** Reenvia uma mensagem FAILED/OPTED_OUT do outbox: zera e tenta na hora. */
export async function reenviarMensagemAction(id: string): Promise<void> {
  await requireAdmin();
  const m = await prisma.whatsAppMessage.findUnique({
    where: { id },
    select: { status: true },
  });
  if (!m || (m.status !== "FAILED" && m.status !== "OPTED_OUT")) return;
  await prisma.whatsAppMessage.update({
    where: { id },
    data: { status: "QUEUED", tentativas: 0, proximaTentativa: null, erro: null },
  });
  await tentarEnviar(id);
  revalidatePath("/admin/mensagens");
}
