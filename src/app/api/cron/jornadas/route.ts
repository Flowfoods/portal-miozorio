import { NextResponse } from "next/server";
import { cronAuthorized } from "@/lib/security";
import { processarJornadas } from "@/lib/jornadas";

/**
 * Cron diário das Jornadas de relacionamento (CRM — Pilar 3). Processa as
 * jornadas ATIVAS e envia aos elegíveis com opt-in. Disparado pelo Dokploy
 * Schedules; protegido por CRON_SECRET. Inerte enquanto nenhuma jornada estiver
 * ativa (nascem desativadas).
 */
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!cronAuthorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const resumo = await processarJornadas();
  return NextResponse.json({ ok: true, ...resumo });
}
