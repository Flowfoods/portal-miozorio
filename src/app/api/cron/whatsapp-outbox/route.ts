import { NextResponse } from "next/server";
import { cronAuthorized } from "@/lib/security";
import { dispatchOutbox } from "@/lib/whatsapp/service";

/**
 * Worker do outbox de WhatsApp (Campanhas F1): reprocessa retries devidos e
 * drena campanhas QUEUED (com throttle anti-ban). Disparado pelo Dokploy Schedules
 * (ex.: a cada 5min) com `Authorization: Bearer $CRON_SECRET`. Fail-closed.
 */
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!cronAuthorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const url = new URL(req.url);
  const limite = Number(url.searchParams.get("limite")) || undefined;
  const resumo = await dispatchOutbox({ limite });
  return NextResponse.json({ ok: true, ...resumo });
}
