"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

/**
 * Link de navegação que marca `aria-current="page"` na rota ativa.
 * Links com âncora (ex.: "/#servicos") nunca ficam "ativos" — evita
 * falso-positivo na home, que não tem item próprio na navegação.
 */
export default function NavLink({
  href,
  className = "",
  activeClassName = "",
  onClick,
  children,
}: {
  href: string;
  className?: string;
  activeClassName?: string;
  onClick?: () => void;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const [path, hash] = href.split("#");
  const base = path || "/";
  const active =
    !hash &&
    (pathname === base || (base !== "/" && pathname.startsWith(`${base}/`)));

  return (
    <Link
      href={href}
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={`${className} ${active ? activeClassName : ""}`.trim()}
    >
      {children}
    </Link>
  );
}
