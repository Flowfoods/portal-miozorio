"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";

const LINKS = [
  { href: "/admin", label: "Agenda" },
  { href: "/admin/servicos", label: "Serviços" },
  { href: "/admin/bloqueios", label: "Bloqueios" },
  { href: "/admin/clientes", label: "Clientes" },
  { href: "/admin/config", label: "Configurações" },
];

export default function AdminNav() {
  const pathname = usePathname();
  return (
    <nav className="mb-8 flex flex-wrap items-center gap-2">
      {LINKS.map((l) => {
        const active =
          l.href === "/admin" ? pathname === "/admin" : pathname.startsWith(l.href);
        return (
          <Link
            key={l.href}
            href={l.href}
            className={`rounded-mi px-4 py-2 text-sm transition-colors ${
              active
                ? "bg-mi-marrom text-white"
                : "bg-mi-branco text-mi-texto hover:bg-mi-cinza"
            }`}
          >
            {l.label}
          </Link>
        );
      })}
      <button
        type="button"
        onClick={() => signOut({ callbackUrl: "/admin/login" })}
        className="ml-auto rounded-mi px-4 py-2 text-sm text-mi-marrom underline-offset-4 hover:underline"
      >
        Sair
      </button>
    </nav>
  );
}
