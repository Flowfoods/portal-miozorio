"use client";

import { usePathname } from "next/navigation";
import AdminSidebar from "./AdminSidebar";

/**
 * Casca do /admin: páginas autenticadas ganham a sidebar à esquerda + conteúdo
 * à direita; páginas pré-auth (login/recuperar/redefinir) ficam centradas, SEM
 * sidebar (não expõe navegação antes do login). Não toca em auth/middleware.
 */
const AUTH_PAGES = ["/admin/login", "/admin/recuperar", "/admin/redefinir"];

export default function AdminShell({
  children,
  badges,
}: {
  children: React.ReactNode;
  /** Contadores por href (ex.: { "/admin/depoimentos": 3 }) — pílula no menu. */
  badges?: Record<string, number>;
}) {
  const pathname = usePathname();
  const isAuthPage = AUTH_PAGES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );

  if (isAuthPage) {
    return (
      <main className="mx-auto min-h-[70vh] w-full max-w-5xl px-4 py-10">
        {children}
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-mi-superficie md:flex">
      <AdminSidebar badges={badges} />
      <div className="min-w-0 flex-1 bg-mi-superficie">
        <main className="mx-auto w-full max-w-5xl px-4 py-8 md:py-10">
          {children}
        </main>
      </div>
    </div>
  );
}
