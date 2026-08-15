import { NextRequest, NextResponse } from "next/server";
import { createBookingBody } from "@/lib/validation";
import { createBooking } from "@/lib/booking-service";
import { EV, getSid, track } from "@/lib/tracking";
import { getClienteSession } from "@/lib/cliente-auth";

export const dynamic = "force-dynamic";

const STATUS_BY_CODE: Record<string, number> = {
  no_consent: 422,
  invalid_service: 404,
  not_bookable: 422,
  invalid_phone: 422,
  invalid_datetime: 422,
  slot_taken: 409, // constraint no_overlap (R2)
};

// POST /api/bookings  → cria pending + hold
export async function POST(req: NextRequest) {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const parsed = createBookingBody.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dados inválidos", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  // Honeypot: campo invisível preenchido = bot. Responde como se tivesse dado
  // certo (sem criar nada) para não ensinar o robô a contornar.
  if (parsed.data.site?.trim()) {
    return NextResponse.json({ id: "", holdExpiresAt: "" }, { status: 201 });
  }

  const result = await createBooking(parsed.data);
  if (!result.ok) {
    const status = STATUS_BY_CODE[result.code] ?? 400;
    return NextResponse.json(
      { error: result.message, code: result.code },
      { status },
    );
  }
  // Tracking F1 (server-authoritative): a cliente concluiu o fluxo de agendar.
  // serviceId não é PII; sanitizeMeta descarta o que não for primitivo simples.
  await track({
    tipo: EV.AGENDAMENTO_CONCLUIDO,
    sessionId: getSid(),
    clientId: getClienteSession()?.customerId ?? null,
    metadata: { servico: parsed.data.serviceId, local: parsed.data.location },
  });

  return NextResponse.json(
    { id: result.id, holdExpiresAt: result.holdExpiresAt },
    { status: 201 },
  );
}
