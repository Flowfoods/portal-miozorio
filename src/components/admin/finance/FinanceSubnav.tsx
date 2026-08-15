"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/admin/financeiro", label: "Visão geral" },
  { href: "/admin/financeiro/custos", label: "Custos" },
  { href: "/admin/financeiro/receitas", label: "Receitas" },
  { href: "/admin/financeiro/categorias", label: "Categorias" },
  { href: "/admin/financeiro/recorrentes", label: "Recorrentes" },
];

/** Abas internas do módulo Financeiro. */
export default function FinanceSubnav() {
  const pathname = usePathname();
  const active = (href: string) =>
    href === "/admin/financeiro"
      ? pathname === "/admin/financeiro"
      : pathname.startsWith(href);
  return (
    <nav className="mb-6 flex flex-wrap gap-1.5 border-b border-mi-cinza/70 pb-3">
      {ITEMS.map((i) => (
        <Link
          key={i.href}
          href={i.href}
          className={`rounded-mi px-3 py-1.5 font-corpo text-sm transition-colors ${
            active(i.href)
              ? "bg-mi-marrom-escuro text-mi-branco"
              : "text-mi-texto hover:bg-mi-marrom/10"
          }`}
        >
          {i.label}
        </Link>
      ))}
    </nav>
  );
}
