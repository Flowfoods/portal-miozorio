import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { runDailyReminders } from "@/lib/reminders";

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

/** Compara o Bearer recebido com CRON_SECRET em tempo constante. */
function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false; // desabilitado até configurar a env
  const header = req.headers.get("authorization") ?? "";
  const m = header.match(/^Bearer\s+(.+)$/);
  if (!m) return false;
  const provided = Buffer.from(m[1]!);
  const expected = Buffer.from(secret);
  if (provided.length !== expected.length) return false;
  return timingSafeEqual(provided, expected);
}

export async function POST(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const summary = await runDailyReminders();
  return NextResponse.json({ ok: true, ...summary });
}
