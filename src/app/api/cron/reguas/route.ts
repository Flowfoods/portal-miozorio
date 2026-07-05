import { NextResponse } from "next/server";
import { cronAuthorized } from "@/lib/security";
import { gerarSugestoes } from "@/lib/reguas";

/**
 * Cron diário das réguas (F4). SÓ GERA SUGESTÕES na fila de aprovação —
 * nenhuma mensagem é enviada aqui (regra da casa: a Mi sempre edita e envia).
 * Dokploy Schedules: curl -fsS -X POST https://miozorio.com.br/api/cron/reguas \
 *   -H "Authorization: Bearer $CRON_SECRET"
 */
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!cronAuthorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const resumo = await gerarSugestoes();
  return NextResponse.json({ ok: true, ...resumo });
}
