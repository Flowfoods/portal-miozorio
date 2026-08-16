import { NextResponse } from "next/server";
import { cronAuthorized } from "@/lib/security";
import { comRegistro } from "@/lib/cron-registro";
import { recalcularRFV } from "@/lib/rfv";

/**
 * Cron diário da Matriz RFV. Recalcula R/F/V, segmento e LTV previsto de toda a
 * base ativa e grava nos clientes. Disparado pelo Dokploy Schedules:
 *   curl -fsS -X POST https://miozorio.com.br/api/cron/rfv \
 *        -H "Authorization: Bearer $CRON_SECRET"
 *
 * Não envia nada (só lê/grava no banco). Protegido por CRON_SECRET (fail-closed).
 * Roda antes do cron de lembretes (ex.: 08:30 SP) para os segmentos do dia já
 * estarem atualizados.
 */
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!cronAuthorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  return comRegistro("rfv", async () => {
    const resumo = await recalcularRFV();
    return NextResponse.json({ ok: true, ...resumo });
  });
}
