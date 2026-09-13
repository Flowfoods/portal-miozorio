import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { gatewayAtivo } from "@/lib/pagamento";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

/**
 * A7 — cria (ou devolve) a cobrança PIX do sinal de uma reserva.
 *
 * Só existe caminho aqui quando há gateway configurado. Sem ele, devolve 501 e
 * a tela da cliente segue no fluxo do WhatsApp — que é o que acontece hoje.
 *
 * Idempotente por reserva: chamar de novo devolve a MESMA cobrança (o
 * `X-Idempotency-Key` do provedor + o `deposit_payment_id` guardado aqui), em
 * vez de abrir um PIX novo a cada recarga da tela.
 */
export async function POST(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const gateway = gatewayAtivo();
  if (!gateway) {
    return NextResponse.json(
      {
        error: "Pagamento pelo portal ainda não está ativo.",
        code: "sem_gateway",
      },
      { status: 501 },
    );
  }

  const booking = await prisma.booking.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      status: true,
      depositCents: true,
      depositPaidAt: true,
      depositPaymentId: true,
      holdExpiresAt: true,
      customer: { select: { name: true, phoneE164: true, email: true } },
      service: { select: { name: true } },
    },
  });

  if (!booking) {
    return NextResponse.json({ error: "Reserva não encontrada." }, { status: 404 });
  }
  if (booking.status !== "pending") {
    return NextResponse.json(
      { error: "Essa reserva não está mais aguardando sinal.", code: "not_pending" },
      { status: 409 },
    );
  }
  if (booking.depositPaidAt) {
    return NextResponse.json({ error: "Sinal já recebido.", code: "ja_pago" }, { status: 409 });
  }
  if (!booking.depositCents || booking.depositCents <= 0) {
    return NextResponse.json(
      { error: "Essa reserva não tem sinal a pagar.", code: "sem_sinal" },
      { status: 422 },
    );
  }

  // A cobrança vence junto com o horário guardado: um PIX que sobrevive ao hold
  // faria a cliente pagar por um horário que já voltou para a agenda.
  const settings = await getSettings();
  const restanteMin = booking.holdExpiresAt
    ? Math.max(
        5,
        Math.floor((booking.holdExpiresAt.getTime() - Date.now()) / 60_000),
      )
    : settings.depositHoldHours * 60;

  try {
    const cobranca = await gateway.criarCobrancaPix({
      bookingId: booking.id,
      valorCents: booking.depositCents,
      descricao: `Sinal — ${booking.service.name} (Mi Ozorio)`,
      pagadorNome: booking.customer.name,
      pagadorTelefone: booking.customer.phoneE164,
      pagadorEmail: booking.customer.email,
      expiraEmMinutos: restanteMin,
    });

    await prisma.booking.update({
      where: { id: booking.id },
      data: {
        depositProvider: gateway.nome,
        depositPaymentId: cobranca.id,
      },
    });

    return NextResponse.json({
      copiaECola: cobranca.copiaECola,
      qrCodeBase64: cobranca.qrCodeBase64,
      expiraEm: cobranca.expiraEm?.toISOString() ?? null,
      valorCents: booking.depositCents,
    });
  } catch (e) {
    console.error("sinal: falha ao criar cobrança", params.id, e);
    // A reserva continua de pé: o WhatsApp da Mi segue como caminho.
    return NextResponse.json(
      {
        error:
          "Não consegui gerar o PIX agora. Seu horário continua guardado — fale com a Mi no WhatsApp.",
        code: "gateway_falhou",
      },
      { status: 502 },
    );
  }
}

/** Consulta o status — a tela faz poll enquanto a cliente paga. */
export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const b = await prisma.booking.findUnique({
    where: { id: params.id },
    select: { status: true, depositPaidAt: true },
  });
  if (!b) {
    return NextResponse.json({ error: "Reserva não encontrada." }, { status: 404 });
  }
  return NextResponse.json({
    pago: b.depositPaidAt != null,
    confirmado: b.status === "confirmed",
  });
}
