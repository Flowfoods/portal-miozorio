import { NextResponse } from "next/server";
import { cronAuthorized } from "@/lib/security";
import { expireStaleHolds } from "@/lib/booking-service";

/**
 * Devolve à agenda os horários de reservas abandonadas (hold vencido e nunca
 * confirmado). Sem isto, a linha `pending` some da tela mas continua barrando
 * a trava do banco: o site oferece o horário e recusa quem tenta pegá-lo.
 *
 * Idempotente (R10) — rodar duas vezes não muda nada, pois só encerra o que
 * ainda está `pending`. Só grava no banco; não envia mensagem para ninguém.
 * Dokploy Schedules (de hora em hora):
 *   curl -fsS -X POST .../api/cron/expirar-reservas \
 *     -H "Authorization: Bearer $CRON_SECRET"
 */
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!cronAuthorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const r = await expireStaleHolds();
  return NextResponse.json({ ok: true, ...r });
}
