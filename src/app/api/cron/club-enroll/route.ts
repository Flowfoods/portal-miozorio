import { NextResponse } from "next/server";
import { cronAuthorized } from "@/lib/security";
import { comRegistro } from "@/lib/cron-registro";
import { enrollAllCustomers } from "@/lib/clube";

/**
 * Backfill (uso pontual, idempotente): inscreve no clube todas as clientes que
 * ainda não são membros. Rodar 1× após o deploy do portal do cliente. Só grava
 * no banco. Protegido por CRON_SECRET (fail-closed).
 */
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!cronAuthorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  return comRegistro("club-enroll", async () => {
    const r = await enrollAllCustomers();
    return NextResponse.json({ ok: true, ...r });
  });
}
