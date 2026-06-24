import { NextResponse } from "next/server";
import { cronAuthorized } from "@/lib/security";
import { runDailyReminders, previewDueReminders } from "@/lib/reminders";

/**
 * Cron diário dos lembretes por tempo (substitui o workflow do n8n).
 * Disparado 1×/dia pelo Dokploy Schedules com:
 *   curl -fsS -X POST https://miozorio.com.br/api/cron/lembretes \
 *        -H "Authorization: Bearer $CRON_SECRET"
 *
 * Protegido por CRON_SECRET (fail-closed: sem a env, responde 401). O envio em
 * si é idempotente e env-gated — ver src/lib/reminders.ts.
 */
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!cronAuthorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  // ?dry=1 → só mostra o que seria enviado hoje, sem enviar nem gravar.
  if (new URL(req.url).searchParams.get("dry") === "1") {
    const preview = await previewDueReminders();
    return NextResponse.json({ ok: true, dryRun: true, ...preview });
  }
  const summary = await runDailyReminders();
  return NextResponse.json({ ok: true, ...summary });
}
