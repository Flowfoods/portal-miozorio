import { prisma } from "../prisma";
import { gatewayAtivo } from "./index";
import { confirmBooking } from "../booking-service";

/**
 * A7 — marca o sinal como recebido e confirma a reserva.
 *
 * Ponto ÚNICO de "o sinal entrou": tanto o webhook quanto o cron de
 * conciliação passam por aqui, então a regra de confirmar não tem duas versões.
 *
 * Idempotente: o `updateMany` só pega a linha que ainda está sem
 * `deposit_paid_at`. Webhook repetido (o Mercado Pago reenvia) não confirma
 * duas vezes nem dispara duas mensagens.
 */
export async function registrarSinalPago(
  cobrancaId: string,
): Promise<{ ok: boolean; bookingId?: string }> {
  const booking = await prisma.booking.findFirst({
    where: { depositPaymentId: cobrancaId },
    select: { id: true, status: true, depositPaidAt: true },
  });
  if (!booking) return { ok: false };
  if (booking.depositPaidAt) return { ok: true, bookingId: booking.id };

  const r = await prisma.booking.updateMany({
    where: { id: booking.id, depositPaidAt: null },
    data: { depositPaidAt: new Date() },
  });
  // Outra execução ganhou a corrida — ela confirma, esta sai.
  if (r.count === 0) return { ok: true, bookingId: booking.id };

  // `confirmBooking` cuida das notificações (A4 avisa a Mi de "sinal pago",
  // A9 avisa a cliente) e da auditoria em booking_events.
  if (booking.status === "pending") {
    const c = await confirmBooking(booking.id, "system");
    if (!c.ok) {
      // O dinheiro entrou: não dá para fingir que não. Fica pago e pendente,
      // e a Mi resolve no painel (o hold vencido, por exemplo, ela confirma
      // manualmente).
      console.error(
        "conciliar: sinal pago mas confirmação recusada",
        booking.id,
        c.code,
      );
    }
  }
  return { ok: true, bookingId: booking.id };
}

/**
 * Varre as cobranças em aberto e pergunta ao provedor. Rede de segurança para
 * webhook perdido — que acontece: entrega falha, deploy no meio, instabilidade.
 * Sem isto, uma cliente que pagou ficaria "aguardando sinal" para sempre.
 */
export async function conciliarSinaisPendentes(): Promise<{
  verificados: number;
  confirmados: number;
}> {
  const gateway = gatewayAtivo();
  if (!gateway) return { verificados: 0, confirmados: 0 };

  const pendentes = await prisma.booking.findMany({
    where: {
      depositPaymentId: { not: null },
      depositPaidAt: null,
      status: "pending",
    },
    select: { id: true, depositPaymentId: true },
    take: 100,
  });

  let confirmados = 0;
  for (const b of pendentes) {
    if (!b.depositPaymentId) continue;
    try {
      const status = await gateway.consultarStatus(b.depositPaymentId);
      if (status === "pago") {
        await registrarSinalPago(b.depositPaymentId);
        confirmados++;
      }
    } catch (e) {
      // Uma cobrança problemática não pode travar a varredura das outras.
      console.error("conciliar: falha ao consultar", b.depositPaymentId, e);
    }
  }
  return { verificados: pendentes.length, confirmados };
}
