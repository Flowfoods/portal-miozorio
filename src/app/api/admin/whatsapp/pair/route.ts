import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { evolutionPairingCode } from "@/lib/evolution-connect";

export const dynamic = "force-dynamic";

/**
 * Código de pareamento por número (alternativa ao QR).
 *
 * O QR só serve para quem tem um segundo aparelho: não dá para ler o código da
 * tela do próprio celular que está com o WhatsApp aberto. Como a Mi opera pelo
 * telefone, este é o caminho principal dela, não o alternativo.
 */
export async function POST(req: Request) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "não autorizado" }, { status: 401 });
  }
  let numero = "";
  try {
    const body = (await req.json()) as { numero?: string };
    numero = String(body?.numero ?? "");
  } catch {
    return NextResponse.json({ error: "Envie o número." }, { status: 400 });
  }
  const r = await evolutionPairingCode(numero);
  if (!r.ok) return NextResponse.json({ error: r.message }, { status: 422 });
  return NextResponse.json({ code: r.code });
}
