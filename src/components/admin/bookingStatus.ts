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
  pending: "bg-amber-100 text-amber-900",
  confirmed: "bg-emerald-100 text-emerald-900",
  completed: "bg-mi-cinza text-mi-texto",
  cancelled_by_client: "bg-red-50 text-red-800",
  cancelled_by_business: "bg-red-50 text-red-800",
  no_show: "bg-red-100 text-red-900",
};
