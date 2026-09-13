import type { BookingStatus, CancelledBy } from "@prisma/client";

/** Rótulos e cores de status compartilhados entre Agenda e ficha da cliente (R13: sem jargão). */
export const STATUS_LABEL: Record<BookingStatus, string> = {
  pending: "Pendente",
  confirmed: "Confirmado",
  completed: "Concluído",
  cancelled_by_client: "Cancelado (cliente)",
  cancelled_by_business: "Cancelado (Mi)",
  no_show: "Não compareceu",
};

export const STATUS_STYLE: Record<BookingStatus, string> = {
  pending: "bg-mi-alerta/10 text-mi-alerta-tinta",
  confirmed: "bg-mi-sucesso/10 text-mi-sucesso-tinta",
  completed: "bg-mi-cinza text-mi-texto",
  cancelled_by_client: "bg-mi-erro/10 text-mi-erro-tinta",
  cancelled_by_business: "bg-mi-erro/10 text-mi-erro-tinta",
  no_show: "bg-mi-erro/10 text-mi-erro-tinta",
};

/**
 * A5 — o rótulo que a Mi realmente vê.
 *
 * `cancelled_by_business` era o status tanto do cancelamento dela quanto da
 * reserva que o cron encerrou por abandono, e a pílula dizia "Cancelado (Mi)"
 * nos dois casos — acusando-a de cancelamentos que nunca fez, bem ao lado da
 * frase de `historiaDoAgendamento` que dizia o contrário.
 *
 * `cancelledBy` desempata. Reservas antigas (sem a coluna preenchida) caem no
 * rótulo cru de sempre — nada regride.
 */
export function statusLabel(
  status: BookingStatus,
  cancelledBy?: CancelledBy | null,
): string {
  if (status === "cancelled_by_business" && cancelledBy === "SYSTEM") {
    return "Expirado (sistema)";
  }
  return STATUS_LABEL[status];
}

export function statusStyle(
  status: BookingStatus,
  cancelledBy?: CancelledBy | null,
): string {
  // Expirado não é erro da Mi nem da cliente: é um horário que voltou pra
  // agenda. Tom neutro, não o vermelho de cancelamento.
  if (status === "cancelled_by_business" && cancelledBy === "SYSTEM") {
    return "bg-mi-cinza text-mi-texto";
  }
  return STATUS_STYLE[status];
}
