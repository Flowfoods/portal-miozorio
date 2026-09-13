import { NextRequest, NextResponse } from "next/server";
import { confirmBooking } from "@/lib/booking-service";
import { COOKIE_POSSE, MSG_SEM_POSSE, temPosse } from "@/lib/posse-booking";

export const dynamic = "force-dynamic";

const STATUS_BY_CODE: Record<string, number> = {
  not_found: 404,
  not_pending: 409,
  hold_expired: 410,
  requires_deposit: 402,
};

// POST /api/bookings/:id/confirm  → pending → confirmed (valida hold + sinal)
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  // Posse: o comprovante httpOnly emitido na criação. Antes desta checagem,
  // qualquer um com o UUID da reserva podia confirmá-la — o dano era contido
  // (ator fixo em `system`, hold e sinal continuavam valendo), mas "ninguém
  // checa" não é propriedade para manter numa rota pública de escrita.
  //
  // A recusa NÃO é um beco sem saída: a reserva segue guardada em `pending` e a
  // Mi fecha pelo WhatsApp — ela já foi avisada na criação. O pior caso desta
  // mudança é uma cliente indo pelo caminho manual, nunca perdendo o horário.
  if (!temPosse(req.cookies.get(COOKIE_POSSE)?.value, params.id)) {
    return NextResponse.json(
      { error: MSG_SEM_POSSE, code: "sem_posse" },
      { status: 403 },
    );
  }

  const result = await confirmBooking(params.id);
  if (!result.ok) {
    const status = STATUS_BY_CODE[result.code] ?? 400;
    return NextResponse.json(
      { error: result.message, code: result.code },
      { status },
    );
  }
  return NextResponse.json({ status: result.status });
}
