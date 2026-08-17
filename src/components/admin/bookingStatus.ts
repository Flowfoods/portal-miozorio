import type { BookingStatus } from "@prisma/client";

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
