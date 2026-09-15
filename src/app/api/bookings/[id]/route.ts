import { NextResponse } from "next/server";
import { getBookingStatus } from "@/lib/booking-service";
import {
  CODIGO_SEM_POSSE,
  temPosseDaReserva,
} from "@/lib/posse-reserva-guarda";

export const dynamic = "force-dynamic";

// GET /api/bookings/:id  → status (polling do checkout)
//
// Mesma posse do `/confirm` e do `/sinal`: o id não é segredo, e sem a guarda
// esta rota contava a quem tivesse um UUID o horário marcado de outra pessoa
// (`startsAt`/`endsAt`) e, pelo 404 contra o 200, se a reserva existia.
//
// Hoje nenhuma tela a consome — o wizard faz poll pelo `/sinal`. A guarda entra
// mesmo assim: rota pública esquecida é exatamente a que volta a ser usada sem
// ninguém relembrar que ela nunca checou dono.
export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
) {
  if (!(await temPosseDaReserva(params.id))) {
    return NextResponse.json(
      {
        error: "Não consegui abrir esse agendamento por aqui.",
        code: CODIGO_SEM_POSSE,
      },
      { status: 403 },
    );
  }

  const booking = await getBookingStatus(params.id);
  if (!booking) {
    return NextResponse.json(
      { error: "Reserva não encontrada" },
      { status: 404 },
    );
  }
  return NextResponse.json(booking);
}
