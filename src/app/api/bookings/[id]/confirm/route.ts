import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { confirmBooking } from "@/lib/booking-service";
import { prisma } from "@/lib/prisma";
import { getClienteSession } from "@/lib/cliente-auth";
import { opcoesCookie } from "@/lib/auth-cookies";
import { nomeCookiePosse, verificarPosse } from "@/lib/posse-reserva";

export const dynamic = "force-dynamic";

const STATUS_BY_CODE: Record<string, number> = {
  not_found: 404,
  not_pending: 409,
  hold_expired: 410,
  requires_deposit: 402,
};

/**
 * Quem pode confirmar esta reserva: quem a criou (comprovante de posse emitido
 * na criação) ou a cliente logada no Clube que é dona dela.
 *
 * A segunda porta existe porque o comprovante mora num navegador só: quem marca
 * pelo portal logado e confirma de outro aparelho — ou depois de uma limpeza de
 * cookies — não pode ficar de fora do próprio agendamento.
 */
async function podeConfirmar(id: string): Promise<boolean> {
  try {
    if (verificarPosse(cookies().get(nomeCookiePosse(id))?.value, id))
      return true;
  } catch (e) {
    // `verificarPosse` não lança por entrada ruim — só por segredo ausente, que
    // é erro de configuração. Vira "não é dono" (403, com caminho de saída) em
    // vez de 500 em cima de uma reserva que está de pé.
    console.error("posse: não consegui conferir o comprovante", id, e);
  }

  const sessao = await getClienteSession();
  if (!sessao) return false;
  // `id` vem da URL: um valor que não é UUID faz o Prisma recusar a consulta, e
  // recusa é a resposta certa aqui de qualquer jeito.
  const reserva = await prisma.booking
    .findUnique({ where: { id }, select: { customerId: true } })
    .catch(() => null);
  return reserva?.customerId === sessao.customerId;
}

// POST /api/bookings/:id/confirm  → pending → confirmed (valida posse + hold + sinal)
export async function POST(
  _req: Request,
  { params }: { params: { id: string } },
) {
  if (!(await podeConfirmar(params.id))) {
    return NextResponse.json(
      {
        error:
          "Não consegui confirmar por aqui. Abra o agendamento no mesmo aparelho em que você marcou, ou chame a Mi no WhatsApp 💛",
        code: "sem_posse",
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
