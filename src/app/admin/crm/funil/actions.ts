"use server";

import { revalidatePath } from "next/cache";
import { FunilEtapa } from "@prisma/client";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * F5 — ações do kanban do funil de noiva. Toda mudança de etapa registra a
 * transição em funil_eventos (tempo por etapa) e o "desde" (alerta de parada).
 * Funil continua 100% WhatsApp — nada aqui cria agendamento online (R14).
 */

export type FunilResult = { ok: true } | { ok: false; message: string };

export async function moverFunilAction(
  customerId: string,
  novaEtapaRaw: string,
): Promise<FunilResult> {
  await requireAdmin();
  if (!(Object.values(FunilEtapa) as string[]).includes(novaEtapaRaw)) {
    return { ok: false, message: "Etapa inválida." };
  }
  const novaEtapa = novaEtapaRaw as FunilEtapa;

  const cliente = await prisma.customer.findUnique({
    where: { id: customerId },
    select: { funilEtapa: true },
  });
  if (!cliente?.funilEtapa) {
    return { ok: false, message: "Essa cliente não está no funil." };
  }
  if (cliente.funilEtapa === novaEtapa) return { ok: true };

  await prisma.$transaction([
    prisma.funilEvento.create({
      data: { customerId, de: cliente.funilEtapa, para: novaEtapa },
    }),
    prisma.customer.update({
      where: { id: customerId },
      data: { funilEtapa: novaEtapa, funilEtapaDesde: new Date() },
    }),
  ]);
  revalidatePath("/admin/crm/funil");
  revalidatePath("/admin/crm");
  return { ok: true };
}

/** Valor estimado do contrato (pipeline) — em reais na tela. */
export async function salvarValorFunilAction(
  customerId: string,
  valorReais: number,
): Promise<FunilResult> {
  await requireAdmin();
  if (!Number.isFinite(valorReais) || valorReais < 0 || valorReais > 1_000_000) {
    return { ok: false, message: "Valor inválido." };
  }
  await prisma.customer.update({
    where: { id: customerId },
    data: { funilValorCents: Math.round(valorReais * 100) },
  });
  revalidatePath("/admin/crm/funil");
  return { ok: true };
}
