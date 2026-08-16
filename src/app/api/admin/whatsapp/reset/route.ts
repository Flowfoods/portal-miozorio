import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { evolutionRecreate } from "@/lib/evolution-connect";

export const dynamic = "force-dynamic";

/**
 * "Começar de novo": apaga e recria a instância na Evolution.
 *
 * A versão anterior só fazia logout — que não alcança o caso real: instância
 * com registro corrompido nem chega a ter sessão para deslogar (diagnóstico de
 * 16/08, log verboso sem nenhum rastro de QR/pareamento). Recriar o registro
 * é o único caminho que devolve um pareamento em folha.
 */
export async function POST() {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "não autorizado" }, { status: 401 });
  }
  const r = await evolutionRecreate();
  if (!r.ok) {
    return NextResponse.json({ error: r.message }, { status: 502 });
  }
  return NextResponse.json({ ok: true });
}
