import { NextResponse } from "next/server";
import {
  aplicarOptOut,
  isOptOutReply,
  registrarEntrega,
} from "@/lib/whatsapp/service";

export const dynamic = "force-dynamic";

/**
 * Receptor de webhooks da Evolution (Campanhas F1). Token obrigatório (fail-closed):
 * `?token=` ou header `x-webhook-token` == EVOLUTION_WEBHOOK_TOKEN.
 *  - mensagem recebida "SAIR"/"PARAR" → opt-out de marketing da cliente.
 *  - update de status → marca entrega/falha no outbox.
 */
export async function POST(req: Request) {
  const expected = process.env.EVOLUTION_WEBHOOK_TOKEN;
  const token =
    new URL(req.url).searchParams.get("token") ??
    req.headers.get("x-webhook-token");
  if (!expected || token !== expected) {
    return NextResponse.json({ error: "não autorizado" }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as
    | { event?: string; data?: unknown }
    | null;
  if (!body) return NextResponse.json({ ok: true });

  try {
    const event = body.event ?? "";
    const data = body.data as Record<string, unknown> | undefined;

    // Mensagem recebida da cliente → opt-out por "SAIR"/"PARAR".
    if (event.startsWith("messages.upsert") && data) {
      const key = data.key as { remoteJid?: string; fromMe?: boolean } | undefined;
      const msg = data.message as
        | { conversation?: string; extendedTextMessage?: { text?: string } }
        | undefined;
      const texto = msg?.conversation ?? msg?.extendedTextMessage?.text ?? "";
      const phone = (key?.remoteJid ?? "").split("@")[0];
      if (key?.fromMe === false && phone && isOptOutReply(texto)) {
        await aplicarOptOut(phone);
      }
    }

    // Update de status de envio → entrega/falha no outbox.
    if (event.startsWith("messages.update") && data) {
      const key = data.key as { remoteJid?: string } | undefined;
      const status = String(
        (data.status as string) ?? (data.update as { status?: string })?.status ?? "",
      ).toUpperCase();
      const phone = (key?.remoteJid ?? "").split("@")[0];
      if (phone && status) {
        const entregue = status.includes("DELIVER") || status.includes("READ");
        const falhou = status.includes("ERROR") || status.includes("FAIL");
        if (entregue || falhou) await registrarEntrega(phone, entregue);
      }
    }
  } catch (e) {
    console.error("webhook evolution: falha ao processar", e);
  }
  return NextResponse.json({ ok: true });
}
