import type { BookingStatus } from "@prisma/client";

/**
 * Traduz o ÚLTIMO evento de um agendamento para uma frase que a Mi entende.
 *
 * A agenda mostrava só o `status` cru, e `cancelled_by_business` virava
 * "Cancelado (Mi)" — inclusive quando quem encerrou foi o sistema, ao expirar
 * uma reserva que a cliente abandonou. Na prática a tela acusava a Mi de
 * cancelamentos que ela nunca fez, e a prova do contrário estava gravada em
 * `booking_events` desde sempre, sem nenhum leitor no portal.
 *
 * Função PURA: recebe o evento, devolve a frase. Sem banco, sem rede.
 */

export interface EventoResumo {
  toStatus: BookingStatus;
  /** customer | client | admin | business | system — cinco valores são gravados. */
  actor: string;
  reason: string | null;
}

/** `client` e `customer` são o mesmo ator, gravados por caminhos diferentes. */
function quem(actor: string): "cliente" | "mi" | "sistema" {
  if (actor === "customer" || actor === "client") return "cliente";
  if (actor === "system") return "sistema";
  return "mi"; // admin | business
}

/**
 * Frase para o cartão da agenda. `null` = nada a acrescentar (o rótulo de
 * status já basta, como em "Confirmado").
 */
export function historiaDoAgendamento(
  ev: EventoResumo | null | undefined,
): string | null {
  if (!ev) return null;
  const autor = quem(ev.actor);

  switch (ev.toStatus) {
    case "cancelled_by_business":
      // O caso que motivou tudo isto: reserva abandonada, encerrada pelo cron.
      if (ev.reason === "reserva_nao_concluida") {
        return "O horário venceu sem a cliente concluir";
      }
      return autor === "sistema"
        ? "Encerrado automaticamente"
        : "Você cancelou";

    case "cancelled_by_client":
      return ev.reason === "fora_do_prazo_sinal_retido"
        ? "A cliente cancelou em cima da hora"
        : "A cliente cancelou";

    case "no_show":
      return "A cliente não veio";

    case "completed":
      return "Atendimento concluído";

    case "confirmed":
      return autor === "cliente" ? "A cliente confirmou" : "Você confirmou";

    case "pending":
      return ev.reason === "encaixe_manual" ? "Encaixe feito por você" : null;

    default:
      return null;
  }
}
