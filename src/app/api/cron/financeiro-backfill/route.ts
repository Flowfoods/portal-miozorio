import { NextResponse } from "next/server";
import { cronAuthorized } from "@/lib/security";
import { comRegistro } from "@/lib/cron-registro";
import { backfillReceitaBookings } from "@/lib/finance/queries";

/**
 * Backfill (uso pontual, idempotente): reconhece a receita de todos os bookings
 * já concluídos que ainda não têm lançamento. Rodar 1× após o deploy do módulo
 * Financeiro; seguro de repetir (não duplica — bookingId é único). Só grava no
 * banco. Protegido por CRON_SECRET (fail-closed).
 */
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!cronAuthorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  return comRegistro("financeiro-backfill", async () => {
    const r = await backfillReceitaBookings();
    return NextResponse.json({ ok: true, ...r });
  });
}
