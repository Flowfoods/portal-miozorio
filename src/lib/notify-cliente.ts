import { prisma } from "./prisma";
import { dispatchEvent } from "./notify";
import { formatBRL } from "./format";

/**
 * A9 — confirmação para a CLIENTE, em todo caminho que confirma.
 *
 * Antes só existia num lugar: a criação de encaixe manual, e mesmo assim
 * apenas se a Mi marcasse "avisar no WhatsApp". Quando ela confirmava um
 * agendamento pendente na agenda, a cliente não recebia nada — ficava sabendo
 * se perguntasse.
 *
 * Centralizado em `confirmBooking`, então vale para os três caminhos: a Mi
 * confirmando no painel, o sinal fechando a reserva e a própria cliente
 * concluindo. O `dedupKey` por booking garante UMA mensagem por confirmação
 * (R10) — inclusive quando o encaixe manual já tinha avisado.
 */

/** Endereço do estúdio (skill miespecialista §1). */
const ENDERECO_ESTUDIO = "Rua Ipoméia, 5 — Vila Maria, Santíssimo/RJ";

export function textoLocal(location: string): string {
  return location === "home"
    ? "📍 Vou até você, no endereço combinado."
    : `📍 No meu estúdio: ${ENDERECO_ESTUDIO}`;
}

export async function notificarClienteConfirmacao(
  bookingId: string,
  /**
   * Sufixo do dedupKey. A reativação (A5) precisa do seu: um agendamento que
   * foi confirmado, cancelado e reativado já gastou a chave da confirmação
   * original — sem sufixo a cliente ficaria sem saber que o horário voltou.
   */
  sufixoDedupe = "",
): Promise<void> {
  try {
    const b = await prisma.booking.findUnique({
      where: { id: bookingId },
      select: {
        startsAt: true,
        location: true,
        priceCents: true,
        customerId: true,
        customer: { select: { name: true, phoneE164: true } },
        service: { select: { name: true, pendingPrice: true } },
        items: {
          orderBy: { sort: "asc" },
          select: { service: { select: { name: true } } },
        },
      },
    });
    if (!b) return;

    const servico =
      b.items.length > 0
        ? b.items.map((i) => i.service.name).join(" + ")
        : b.service.name;

    await dispatchEvent({
      kind: "booking_confirmation",
      // Mesma chave que o encaixe manual já usava: se ele avisou, esta não
      // reenvia. Um evento de confirmação = uma mensagem.
      dedupKey: `booking_confirmation:${bookingId}${sufixoDedupe}`,
      data: {
        nome: b.customer.name,
        telefone: b.customer.phoneE164,
        clienteId: b.customerId,
        servico,
        inicio: b.startsAt.toISOString(),
        local: textoLocal(b.location),
        // "Preço a confirmar" não pode virar "R$ 0,00" na mensagem.
        valor: b.service.pendingPrice
          ? "💛 O valor a gente combina junto."
          : `💛 Valor: ${formatBRL(b.priceCents)}`,
      },
    });
  } catch (e) {
    console.error("notificarClienteConfirmacao: falha em", bookingId, e);
  }
}
