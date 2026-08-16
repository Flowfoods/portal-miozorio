import { NextResponse } from "next/server";
import { DateTime } from "luxon";
import { cronAuthorized } from "@/lib/security";
import { comRegistro } from "@/lib/cron-registro";
import { prisma } from "@/lib/prisma";
import { getCrmConfig } from "@/lib/crm-config";

/**
 * F6/LGPD — limpeza de eventos de comportamento além da retenção configurada
 * (default 24 meses; editável na régua do CRM). Dados de evento também caem
 * em cascata quando a cliente é excluída — isto aqui cobre o envelhecimento.
 * Dokploy Schedules (semanal): curl -fsS -X POST .../api/cron/limpeza-eventos \
 *   -H "Authorization: Bearer $CRON_SECRET"
 */
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!cronAuthorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  return comRegistro("limpeza-eventos", async () => {
    const cfg = await getCrmConfig();
    const corte = DateTime.now()
      .minus({ months: cfg.limiares.retencaoEventosMeses })
      .toJSDate();
    const r = await prisma.clientEvent.deleteMany({
      where: { createdAt: { lt: corte } },
    });
    return NextResponse.json({
      ok: true,
      apagados: r.count,
      retencaoMeses: cfg.limiares.retencaoEventosMeses,
    });
  });
}
