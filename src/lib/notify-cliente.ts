import { prisma } from "./prisma";
import { dispatchEvent } from "./notify";
import { getSiteContent, aplicarTemplate } from "./content";
import { sendTransactional } from "./whatsapp/service";
import { saldoDoCliente } from "./clube-pontos";
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

/**
 * A10 — mensagem logo após o atendimento, com o extrato do Clube.
 *
 * O portal já creditava os pontos em silêncio (`creditarPontosServico`): a
 * cliente ganhava e não ficava sabendo, então o Clube não gerava o retorno que
 * justifica existir. `msg.pos_atendimento` (D+1) é outra coisa e continua como
 * está — pede depoimento no dia seguinte.
 *
 * Chamada DEPOIS do crédito, então `pontosAgora` já inclui o que entrou; o
 * saldo anterior é a subtração. Best-effort e idempotente por booking.
 */
export async function notificarClienteConcluido(
  bookingId: string,
): Promise<void> {
  try {
    const b = await prisma.booking.findUnique({
      where: { id: bookingId },
      select: {
        customerId: true,
        customer: {
          select: { name: true, phoneE164: true, clubJoinedAt: true },
        },
        service: { select: { clubPoints: true } },
      },
    });
    if (!b) return;

    const content = await getSiteContent();
    const linkClube = `${process.env.NEXT_PUBLIC_SITE_URL ?? "https://miozorio.com.br"}/clube`;
    const primeiroNome = b.customer.name.trim().split(/\s+/)[0] ?? b.customer.name;
    const membro = b.customer.clubJoinedAt != null;

    let texto: string;
    if (!membro) {
      texto = aplicarTemplate(
        content["msg.atendimento_concluido_nao_membro"] ?? "",
        { nome: primeiroNome, linkClube },
      );
    } else {
      const pontosAgora = await saldoDoCliente(b.customerId);
      // `creditarPontosServico` só credita se o serviço vale pontos e ela é
      // membro — as mesmas condições daqui, então a subtração bate.
      const pontosGanhos = b.service.clubPoints > 0 ? b.service.clubPoints : 0;
      texto = aplicarTemplate(content["msg.atendimento_concluido"] ?? "", {
        nome: primeiroNome,
        pontosAntes: String(pontosAgora - pontosGanhos),
        pontosGanhos: String(pontosGanhos),
        pontosAgora: String(pontosAgora),
        linkClube,
      });
    }

    if (!texto.trim()) return;

    await sendTransactional({
      telefone: b.customer.phoneE164.replace(/\D/g, ""),
      texto,
      dedupeKey: `atendimento_concluido:${bookingId}`,
      templateKey: "atendimento_concluido",
      clienteId: b.customerId,
    });
  } catch (e) {
    console.error("notificarClienteConcluido: falha em", bookingId, e);
  }
}
