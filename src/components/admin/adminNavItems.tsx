import type { ReactNode } from "react";

/**
 * Fonte ÚNICA da navegação do painel /admin (label + href + ícone).
 * Usada pela AdminSidebar. Ícones = SVG inline (sem dependência nova).
 */
function I({ children }: { children: ReactNode }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="shrink-0"
    >
      {children}
    </svg>
  );
}

export interface AdminNavItem {
  href: string;
  label: string;
  icon: ReactNode;
}

export const ADMIN_NAV: AdminNavItem[] = [
  {
    href: "/admin",
    label: "Agenda",
    icon: (
      <I>
        <rect x="3" y="4" width="18" height="17" rx="2" />
        <path d="M3 9h18M8 2v4M16 2v4" />
      </I>
    ),
  },
  {
    href: "/admin/resumo",
    label: "Resumo",
    icon: (
      <I>
        <line x1="5" y1="20" x2="5" y2="11" />
        <line x1="12" y1="20" x2="12" y2="4" />
        <line x1="19" y1="20" x2="19" y2="8" />
      </I>
    ),
  },
  {
    href: "/admin/servicos",
    label: "Serviços",
    icon: (
      <I>
        <path d="M12 3l1.7 4.8L18.5 9l-4.8 1.2L12 15l-1.7-4.8L5.5 9l4.8-1.2z" />
        <path d="M18 15l.7 2 2.3.7-2 .7-1 2-.7-2-2.3-.7 2.3-.7z" />
      </I>
    ),
  },
  {
    href: "/admin/fotos",
    label: "Fotos",
    icon: (
      <I>
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <circle cx="8.5" cy="8.5" r="1.5" />
        <path d="M21 15l-5-5L5 21" />
      </I>
    ),
  },
  {
    href: "/admin/conteudo",
    label: "Textos",
    icon: (
      <I>
        <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
        <path d="M14 3v6h6M8 13h8M8 17h6" />
      </I>
    ),
  },
  {
    href: "/admin/pacotes",
    label: "Pacotes",
    icon: (
      <I>
        <path d="M21 16V8l-9-5-9 5v8l9 5 9-5z" />
        <path d="M3 8l9 5 9-5M12 13v8" />
      </I>
    ),
  },
  {
    href: "/admin/depoimentos",
    label: "Depoimentos",
    icon: (
      <I>
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </I>
    ),
  },
  {
    href: "/admin/bloqueios",
    label: "Bloqueios",
    icon: (
      <I>
        <circle cx="12" cy="12" r="9" />
        <line x1="5.6" y1="5.6" x2="18.4" y2="18.4" />
      </I>
    ),
  },
  {
    href: "/admin/clientes",
    label: "Clientes",
    icon: (
      <I>
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      </I>
    ),
  },
  {
    href: "/admin/clube",
    label: "Clube",
    icon: (
      <I>
        <circle cx="12" cy="8" r="6" />
        <path d="M8.2 13.4L7 22l5-3 5 3-1.2-8.6" />
      </I>
    ),
  },
  {
    href: "/admin/usuarias",
    label: "Usuárias",
    icon: (
      <I>
        <path d="M12 2l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V5z" />
        <circle cx="12" cy="10" r="2.2" />
        <path d="M8.5 16c.7-1.6 2-2.4 3.5-2.4s2.8.8 3.5 2.4" />
      </I>
    ),
  },
  {
    href: "/admin/config",
    label: "Configurações",
    icon: (
      <I>
        <circle cx="12" cy="12" r="3" />
        <path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M19.1 4.9L17 7M7 17l-2.1 2.1" />
      </I>
    ),
  },
];
