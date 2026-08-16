import { NextResponse } from "next/server";
import { DateTime } from "luxon";
import { cronAuthorized } from "@/lib/security";
import { comRegistro } from "@/lib/cron-registro";
import { getSettings } from "@/lib/settings";
import { gerarRecorrentesDoMes } from "@/lib/finance/queries";

/**
 * Cron mensal (dia 1): gera as despesas do mês a partir dos custos recorrentes
 * ativos. Idempotente (não duplica). Só grava no banco — não envia nada.
 * Protegido por CRON_SECRET (fail-closed). Disparo via Dokploy Schedules:
 *   POST /api/cron/custos-recorrentes  (Authorization: Bearer $CRON_SECRET)
 */
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!cronAuthorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  return comRegistro("custos-recorrentes", async () => {
    const { timezone } = await getSettings();
    const agora = DateTime.now().setZone(timezone);
    const r = await gerarRecorrentesDoMes(agora.year, agora.month);
    return NextResponse.json({ ok: true, mes: agora.toFormat("yyyy-MM"), ...r });
  });
}
