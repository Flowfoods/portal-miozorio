"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin, getAdminSession } from "@/lib/auth";
import {
  crmConfigSchema,
  saveCrmConfig,
  type CrmConfigData,
} from "@/lib/crm-config";
import { previewSegmentacao, recalcularRFV } from "@/lib/rfv";

/**
 * Server actions da régua RFV (CRM 2.0 F2). Chamadas imperativas de client
 * component → retornam {ok,...} para erro inline (form complexo; melhor UX que
 * o error.tsx). requireAdmin em todas (defesa dupla, padrão do painel).
 */

export type PreviewResult =
  | { ok: true; base: number; porSegmento: Record<string, number> }
  | { ok: false; message: string };

/** Prévia SEM gravar: quantas clientes cairiam em cada segmento. */
export async function previewCrmConfigAction(
  data: unknown,
): Promise<PreviewResult> {
  await requireAdmin();
  const parsed = crmConfigSchema.safeParse(data);
  if (!parsed.success) {
    return { ok: false, message: primeiraMensagem(parsed.error) };
  }
  const { base, porSegmento } = await previewSegmentacao(parsed.data);
  return { ok: true, base, porSegmento };
}

export type SaveResult = { ok: true } | { ok: false; message: string };

/** Salva nova versão da régua e já reclassifica toda a base. */
export async function saveCrmConfigAction(data: unknown): Promise<SaveResult> {
  await requireAdmin();
  const parsed = crmConfigSchema.safeParse(data);
  if (!parsed.success) {
    return { ok: false, message: primeiraMensagem(parsed.error) };
  }
  const session = await getAdminSession();
  await saveCrmConfig(
    parsed.data as CrmConfigData,
    session?.user?.email ?? null,
  );
  await recalcularRFV(); // efeito imediato — a Mi vê o resultado na hora
  revalidatePath("/admin/crm");
  revalidatePath("/admin/crm/rfv");
  revalidatePath("/admin/crm/config");
  return { ok: true };
}

/** Botão "Recalcular agora" (sem mudar a régua). */
export async function recalcularAgoraAction(): Promise<
  { ok: true; base: number } | { ok: false; message: string }
> {
  await requireAdmin();
  try {
    const r = await recalcularRFV();
    revalidatePath("/admin/crm");
    revalidatePath("/admin/crm/rfv");
    return { ok: true, base: r.base };
  } catch (e) {
    console.error("crm-config: recalcular agora falhou", e);
    return { ok: false, message: "Não deu para recalcular agora. Tente de novo." };
  }
}

function primeiraMensagem(err: { issues: { message: string; path: PropertyKey[] }[] }): string {
  const i = err.issues[0];
  if (!i) return "Configuração inválida.";
  return i.message === "Invalid input"
    ? "Confira os valores preenchidos."
    : i.message;
}
