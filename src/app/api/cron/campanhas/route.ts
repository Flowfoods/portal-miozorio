import { NextResponse } from "next/server";
import { cronAuthorized } from "@/lib/security";
import { avaliarAutomaticas, registrarConversoes } from "@/lib/campanhas/service";

/**
 * Cron das campanhas (F2): avalia gatilhos das automáticas → gera envios (ou
 * pendentes p/ aprovação) e marca conversões da janela. Dokploy Schedules
 * (1×/dia). Fail-closed por CRON_SECRET.
 */
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!cronAuthorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const auto = await avaliarAutomaticas();
  const conversoes = await registrarConversoes();
  return NextResponse.json({ ok: true, ...auto, conversoes });
}
