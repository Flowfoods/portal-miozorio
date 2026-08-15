import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { evolutionLogout } from "@/lib/evolution-connect";

export const dynamic = "force-dynamic";

/**
 * Encerra a sessão do WhatsApp para parear do zero.
 *
 * Instância presa em "connecting" devolve QR que já nasce inválido — a pessoa
 * aponta a câmera, nada acontece, e não havia saída pelo painel. Este é o
 * "desligar e ligar de novo" que faltava.
 */
export async function POST() {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "não autorizado" }, { status: 401 });
  }
  const ok = await evolutionLogout();
  if (!ok) {
    return NextResponse.json(
      { error: "Não consegui encerrar a sessão agora. Tente de novo." },
      { status: 502 },
    );
  }
  return NextResponse.json({ ok: true });
}
