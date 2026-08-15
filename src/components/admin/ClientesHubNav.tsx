"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * Sub-navegação do hub "Clientes" — uma porta só no menu, três dimensões da
 * mesma pessoa: a Lista (espinha dorsal), o CRM (relacionamento/RFV/jornadas)
 * e o Clube (fidelidade/pontos). Rotas preservadas; só o ponto de entrada
 * foi unificado. O perfil 360º de cada cliente vive em /admin/clientes/[id].
 */
const ITEMS = [
  { href: "/admin/clientes", label: "Clientes" },
  { href: "/admin/crm", label: "Relacionamento" },
  { href: "/admin/clube", label: "Clube" },
];

export default function ClientesHubNav() {
  const pathname = usePathname();
  const active = (href: string) =>
    href === "/admin/clientes"
      ? pathname === "/admin/clientes" || pathname.startsWith("/admin/clientes/")
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
