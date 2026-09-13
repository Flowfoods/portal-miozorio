import { NextResponse } from "next/server";
import { cronAuthorized } from "@/lib/security";
import { comRegistro } from "@/lib/cron-registro";
import { conciliarSinaisPendentes } from "@/lib/pagamento/conciliar";

/**
 * A7 — rede de segurança para webhook perdido.
 *
 * Webhook falha: entrega cai, deploy no meio, instabilidade do provedor. Sem
 * esta varredura, uma cliente que PAGOU ficaria "aguardando sinal" até o hold
 * vencer — o pior desfecho possível, porque o dinheiro entrou.
 *
 * Idempotente (R10): `registrarSinalPago` só age em cobrança ainda sem
 * `deposit_paid_at`. Sem gateway configurado, é no-op.
 *
 * Dokploy Schedules (a cada 10 min):
 *   curl -fsS -X POST .../api/cron/conciliar-sinais \
 *     -H "Authorization: Bearer $CRON_SECRET"
 */
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!cronAuthorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return comRegistro("conciliar-sinais", async () => {
    const r = await conciliarSinaisPendentes();
    return NextResponse.json({ ok: true, ...r });
  });
}
