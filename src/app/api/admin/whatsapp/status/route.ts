import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { evolutionStatus } from "@/lib/evolution-connect";

export const dynamic = "force-dynamic";

/**
 * Estado + QR da instância WhatsApp (admin). Protegido por sessão — o segredo da
 * Evolution fica no servidor; o browser só recebe o estado e a imagem do QR.
 */
export async function GET() {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "não autorizado" }, { status: 401 });
  }
  const status = await evolutionStatus();
  return NextResponse.json(status);
}
