import { NextResponse } from "next/server";
import { confirmBooking } from "@/lib/booking-service";
import { opcoesCookie } from "@/lib/auth-cookies";
import { nomeCookiePosse } from "@/lib/posse-reserva";
import {
  CODIGO_SEM_POSSE,
  temPosseDaReserva,
} from "@/lib/posse-reserva-guarda";

export const dynamic = "force-dynamic";

const STATUS_BY_CODE: Record<string, number> = {
  not_found: 404,
  not_pending: 409,
  hold_expired: 410,
  requires_deposit: 402,
};

// POST /api/bookings/:id/confirm  → pending → confirmed (valida posse + hold + sinal)
export async function POST(
  _req: Request,
  { params }: { params: { id: string } },
) {
  if (!(await temPosseDaReserva(params.id))) {
    return NextResponse.json(
      {
        error:
          "Não consegui confirmar por aqui. Abra o agendamento no mesmo aparelho em que você marcou, ou chame a Mi no WhatsApp 💛",
        code: CODIGO_SEM_POSSE,
      },
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

  const res = NextResponse.json({ status: result.status });
  // O comprovante já cumpriu o papel — reserva confirmada não volta a pendente
  // (R21), então deixá-lo no navegador seria só um cookie parado.
  res.cookies.set(nomeCookiePosse(params.id), "", {
    ...opcoesCookie(0),
    maxAge: 0,
  });
  return res;
}
