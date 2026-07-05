import { NextRequest, NextResponse } from "next/server";
import { ensureSid, track, CLIENT_EMITTABLE } from "@/lib/tracking";
import { getClienteSession } from "@/lib/cliente-auth";

// Beacon de tracking first-party (CRM 2.0 F1). O cliente só emite tipos da lista
// branca; o clientId é resolvido AQUI pela sessão (nunca vem do corpo).
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  let body: { tipo?: unknown; metadata?: unknown } = {};
  try {
    body = await req.json();
  } catch {
    // corpo inválido → ignora silenciosamente
  }

  const tipo = typeof body?.tipo === "string" ? body.tipo : "";
  if (!CLIENT_EMITTABLE.has(tipo)) {
    // Não revela quais tipos são válidos: responde igual pro caso inválido.
    return new NextResponse(null, { status: 204 });
  }

  const sid = ensureSid();
  const session = getClienteSession();
  await track({
    tipo,
    sessionId: sid,
    clientId: session?.customerId ?? null,
    metadata: body?.metadata,
  });

  return new NextResponse(null, { status: 204 });
}
