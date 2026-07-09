"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { contarSegmento, amostraSegmento, type SegmentoConfig } from "@/lib/campanhas/segmento";
import {
  dispararCampanha,
  aprovarPendentes,
  PRESETS_AUTOMATICOS,
} from "@/lib/campanhas/service";
import { temLinkBooking } from "@/lib/campanhas/template";

/** Número da Mi (só dígitos) para o disparo de teste. */
function numeroMi(): string {
  return (process.env.WHATSAPP_MI ?? "5521970225231").replace(/\D/g, "");
}

export interface PreviewResult {
  count: number;
  amostra: { nome: string; telefone: string }[];
}

/** Contagem em tempo real + amostra de 5 nomes do segmento. */
export async function previewSegmentoAction(
  cfg: SegmentoConfig,
): Promise<PreviewResult> {
  await requireAdmin();
  const [count, amostra] = await Promise.all([
    contarSegmento(cfg),
    amostraSegmento(cfg, 5),
  ]);
  return {
    count,
    amostra: amostra.map((a) => ({
      nome: a.nome,
      telefone: `***${a.telefone.replace(/\D/g, "").slice(-4)}`,
    })),
  };
}

export type CriarResult = { ok: true; id: string } | { ok: false; message: string };

export async function criarCampanhaAction(
  nome: string,
  corpo: string,
  segmento: SegmentoConfig,
): Promise<CriarResult> {
  await requireAdmin();
  if (nome.trim().length < 2) return { ok: false, message: "Dê um nome à campanha." };
  if (corpo.trim().length < 5) return { ok: false, message: "Escreva a mensagem." };
  // Regra inviolável: se o segmento é de funil (noiva/deb), proibido link de booking.
  if (segmento.funilLeads && temLinkBooking(corpo)) {
    return {
      ok: false,
      message:
        "Noiva/Debutante não recebe link de agendamento. Use {link_agenda} (vira WhatsApp) ou tire o /agendar.",
    };
  }
  const c = await prisma.campanha.create({
    data: {
      nome: nome.trim(),
      tipo: "PONTUAL",
      status: "RASCUNHO",
      segmentoConfig: segmento as object,
      corpo: corpo.trim(),
    },
    select: { id: true },
  });
  revalidatePath("/admin/campanhas");
  return { ok: true, id: c.id };
}

export async function dispararTesteAction(id: string): Promise<void> {
  await requireAdmin();
  await dispararCampanha(id, { teste: numeroMi() });
  revalidatePath(`/admin/campanhas/${id}`);
}

export async function dispararAction(id: string): Promise<void> {
  await requireAdmin();
  await dispararCampanha(id);
  revalidatePath(`/admin/campanhas/${id}`);
  revalidatePath("/admin/campanhas");
}

export async function aprovarPendentesAction(id: string): Promise<void> {
  await requireAdmin();
  await aprovarPendentes(id);
  revalidatePath(`/admin/campanhas/${id}`);
}

export async function alternarStatusAction(id: string, ativar: boolean): Promise<void> {
  await requireAdmin();
  await prisma.campanha.update({
    where: { id },
    data: { status: ativar ? "ATIVA" : "PAUSADA" },
  });
  revalidatePath("/admin/campanhas");
}

/** Ativa um preset automático (cria a campanha AUTOMATICA já ATIVA). */
export async function ativarPresetAction(recorrencia: string): Promise<void> {
  await requireAdmin();
  const p = PRESETS_AUTOMATICOS.find((x) => x.recorrencia === recorrencia);
  if (!p) return;
  const existe = await prisma.campanha.findFirst({
    where: { tipo: "AUTOMATICA", recorrencia },
    select: { id: true },
  });
  if (existe) {
    await prisma.campanha.update({ where: { id: existe.id }, data: { status: "ATIVA" } });
  } else {
    await prisma.campanha.create({
      data: {
        nome: p.nome,
        tipo: "AUTOMATICA",
        status: "ATIVA",
        recorrencia,
        segmentoConfig: p.segmento as object,
        corpo: p.corpo,
        modoAprovacao: true,
      },
    });
  }
  revalidatePath("/admin/campanhas");
}
