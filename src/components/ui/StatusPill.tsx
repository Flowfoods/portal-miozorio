import type { BookingStatus } from "@prisma/client";
import { STATUS_LABEL, STATUS_STYLE } from "@/components/admin/bookingStatus";

/**
 * Pílula de status com cor E ícone (a cor nunca comunica sozinha — V4/a11y).
 * Ícones em stroke 2px, herdando a cor da tinta do status.
 */
const ICONE: Record<BookingStatus, JSX.Element> = {
  pending: (
    // relógio
    <>
      <circle cx="8" cy="8" r="6" />
      <path d="M8 5v3l2 1.5" />
    </>
  ),
  confirmed: (
    // check
    <path d="M3.5 8.5 6.5 11.5 12.5 4.5" />
  ),
  completed: (
    // check duplo
    <>
      <path d="M2.5 8.5 5 11 10 5" />
      <path d="M8 10.5 9.5 12 14 6.5" />
    </>
  ),
  cancelled_by_client: <path d="M4.5 4.5l7 7M11.5 4.5l-7 7" />,
  cancelled_by_business: <path d="M4.5 4.5l7 7M11.5 4.5l-7 7" />,
  no_show: (
    // círculo cortado
    <>
      <circle cx="8" cy="8" r="6" />
      <path d="M3.8 3.8l8.4 8.4" />
    </>
  ),
};

export default function StatusPill({
  status,
  className = "",
}: {
  status: BookingStatus;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-corpo text-xs font-medium ${STATUS_STYLE[status]} ${className}`}
    >
      <svg
        width="13"
        height="13"
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        className="shrink-0"
      >
        {ICONE[status]}
      </svg>
      {STATUS_LABEL[status]}
    </span>
  );
}
