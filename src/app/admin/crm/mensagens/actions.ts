"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendEvolutionText, evolutionConfigured } from "@/lib/notify";
import { gerarSugestoes } from "@/lib/reguas";

/**
 * Fila de mensagens (F4). Regra da casa: NADA é enviado sem passar por aqui —
 * a Mi lê, edita/personaliza e só então envia. O texto final (editado) fica
 * gravado no EnvioMensagem (log do perfil 360).
 */

export type FilaResult = { ok: true } | { ok: false; message: string };

/** Envia UMA mensagem da fila com o texto que a Mi editou. */
export async function enviarMensagemAction(
  id: string,
  textoEditado: string,
): Promise<FilaResult> {
  await requireAdmin();
  const texto = textoEditado.trim();
  if (texto.length < 2) {
    return { ok: false, message: "Escreva a mensagem antes de enviar." };
  }
  if (!evolutionConfigured()) {
    return {
      ok: false,
      message: "WhatsApp não configurado no servidor (Evolution).",
    };
  }

  const envio = await prisma.envioMensagem.findUnique({
    where: { id },
    include: { customer: { select: { phoneE164: true, whatsappOptIn: true } } },
  });
  if (!envio || envio.status !== "aguardando") {
    return { ok: false, message: "Essa sugestão já foi tratada." };
  }
  if (!envio.customer.whatsappOptIn) {
    await prisma.envioMensagem.update({
      where: { id },
      data: { status: "cancelado", erro: "cliente sem opt-in" },
    });
    revalidatePath("/admin/crm/mensagens");
    return { ok: false, message: "Essa cliente não deu opt-in de WhatsApp." };
  }

  const number = envio.customer.phoneE164.replace(/\D/g, "");
  try {
    await sendEvolutionText(number, texto);
    await prisma.envioMensagem.update({
      where: { id },
      data: { status: "enviado", texto, enviadoEm: new Date() },
    });
  } catch (e) {
    await prisma.envioMensagem.update({
      where: { id },
      data: { status: "falha", texto, erro: String(e).slice(0, 300) },
    });
    revalidatePath("/admin/crm/mensagens");
    return {
      ok: false,
      message: "O WhatsApp não respondeu — a mensagem ficou marcada como falha.",
    };
  }
  revalidatePath("/admin/crm/mensagens");
  revalidatePath("/admin/crm");
  return { ok: true };
}

/** Descarta uma sugestão (não envia; não volta a sugerir no mês — dedup). */
export async function descartarMensagemAction(id: string): Promise<FilaResult> {
  await requireAdmin();
  const r = await prisma.envioMensagem.updateMany({
    where: { id, status: "aguardando" },
    data: { status: "cancelado" },
  });
  revalidatePath("/admin/crm/mensagens");
  revalidatePath("/admin/crm");
  return r.count === 1
    ? { ok: true }
    : { ok: false, message: "Essa sugestão já foi tratada." };
}

/** Botão "Buscar sugestões agora" (mesmo gerador do cron diário). */
export async function gerarSugestoesAction(): Promise<
  { ok: true; criadas: number } | { ok: false; message: string }
> {
  await requireAdmin();
  try {
    const r = await gerarSugestoes();
    revalidatePath("/admin/crm/mensagens");
    revalidatePath("/admin/crm");
    return { ok: true, criadas: r.criadas };
  } catch (e) {
    console.error("reguas: gerar sugestões falhou", e);
    return { ok: false, message: "Não deu para buscar sugestões agora." };
  }
}
