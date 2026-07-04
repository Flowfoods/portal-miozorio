"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { ADMIN_NAV } from "./adminNavItems";

/**
 * Navegação do painel /admin como sidebar vertical à esquerda, com 3 estados:
 *  - Expandida (lg, ícone + rótulo, ~240px)
 *  - Trilho (md, só ícones ~64px; rótulo via title/aria-label) — automático
 *  - Gaveta off-canvas (mobile, atrás do hambúrguer; backdrop, Esc, focus trap,
 *    fecha ao navegar)
 * Toggle manual de recolher (lg) com preferência lembrada em localStorage.
 * Não toca em auth/sessão — só o "chrome" de navegação.
 */
const STORAGE_KEY = "mi-admin-sidebar-collapsed";

export default function AdminSidebar({
  badges,
}: {
  badges?: Record<string, number>;
}) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false); // recolher manual (lg)
  const [open, setOpen] = useState(false); // gaveta mobile
  const hamburgerRef = useRef<HTMLButtonElement>(null);
  const asideRef = useRef<HTMLElement>(null);
  const activeRef = useRef<HTMLAnchorElement>(null);

  // Garante que o item ativo fique visível ao abrir/navegar (telas baixas).
  useEffect(() => {
    const el = activeRef.current;
    if (!el) return;
    const smooth = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollIntoView({ block: "nearest", behavior: smooth ? "smooth" : "auto" });
  }, [pathname]);

  // Restaura a preferência de recolhido (lg) do localStorage.
  useEffect(() => {
    setCollapsed(localStorage.getItem(STORAGE_KEY) === "1");
  }, []);
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, collapsed ? "1" : "0");
  }, [collapsed]);

  // Trava o scroll do body enquanto a gaveta está aberta (mobile).
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Esc fecha; Tab fica preso na gaveta; foca o 1º item ao abrir.
  useEffect(() => {
    if (!open) return;
    const getFocusables = () =>
      Array.from(
        asideRef.current?.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled])',
        ) ?? [],
      );
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        closeDrawer();
        return;
      }
      if (e.key !== "Tab") return;
      const items = getFocusables();
      if (items.length === 0) return;
      const first = items[0]!;
      const last = items[items.length - 1]!;
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    const id = window.setTimeout(() => getFocusables()[0]?.focus(), 20);
    return () => {
      document.removeEventListener("keydown", onKey);
      window.clearTimeout(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function closeDrawer() {
    setOpen(false);
    hamburgerRef.current?.focus();
  }

  const isActive = (href: string) =>
    href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);

  return (
    <>
      {/* Barra superior só no mobile: hambúrguer + marca */}
      <div className="sticky top-0 z-30 flex items-center gap-3 border-b border-mi-cinza/60 bg-mi-superficie-nav/90 px-4 py-3 backdrop-blur md:hidden">
        <button
          ref={hamburgerRef}
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Abrir menu do painel"
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-controls="admin-sidebar"
          className="inline-flex h-11 w-11 items-center justify-center rounded-mi text-mi-marrom-escuro transition-colors hover:bg-mi-marrom/10"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>
        <span className="font-titulo text-lg text-mi-marrom-escuro">
          Mi Ozorio · Admin
        </span>
      </div>

      {/* Backdrop da gaveta (mobile) */}
      {open && (
        <div
          onClick={closeDrawer}
          aria-hidden="true"
          className="mi-fade-in fixed inset-0 z-40 bg-mi-marrom-escuro/40 backdrop-blur-sm md:hidden"
        />
      )}

      {/* Sidebar */}
      <aside
        id="admin-sidebar"
        ref={asideRef}
        data-collapsed={collapsed}
        data-open={open}
        role={open ? "dialog" : undefined}
        aria-modal={open ? true : undefined}
        aria-label="Navegação do painel"
        className="group fixed inset-y-0 left-0 z-50 flex w-64 -translate-x-full flex-col border-r border-mi-cinza/60 bg-mi-superficie-nav shadow-nav-col transition-transform duration-200 data-[open=true]:translate-x-0 motion-reduce:transition-none md:sticky md:top-0 md:z-auto md:h-screen md:w-16 md:translate-x-0 lg:w-60 data-[collapsed=true]:lg:w-16"
      >
        {/* Cabeçalho: marca + recolher (lg) */}
        <div className="flex h-[57px] items-center gap-2 border-b border-mi-cinza/60 px-3 md:justify-center lg:justify-between group-data-[collapsed=true]:lg:justify-center">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-mi bg-mi-marrom font-titulo text-sm text-mi-branco group-data-[collapsed=true]:lg:hidden">
            Mi
          </span>
          <span className="flex-1 truncate font-titulo text-base text-mi-marrom-escuro inline md:hidden lg:inline group-data-[collapsed=true]:lg:hidden">
            Ozorio · Admin
          </span>
          <button
            type="button"
            onClick={() => setCollapsed((v) => !v)}
            aria-label={collapsed ? "Expandir menu" : "Recolher menu"}
            aria-expanded={!collapsed}
            title={collapsed ? "Expandir" : "Recolher"}
            className="hidden h-8 w-8 shrink-0 items-center justify-center rounded-mi text-mi-marrom transition-colors hover:bg-mi-marrom/10 lg:inline-flex"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
              className="transition-transform group-data-[collapsed=true]:rotate-180 motion-reduce:transition-none"
            >
              <path d="M11 17l-5-5 5-5M18 17l-5-5 5-5" />
            </svg>
          </button>
        </div>

        {/* Navegação */}
        <nav
          aria-label="Navegação do painel"
          className="mi-scroll flex-1 overflow-y-auto px-2 py-3"
        >
          <ul className="flex flex-col gap-1">
            {ADMIN_NAV.map((item) => {
              const active = isActive(item.href);
              const count = badges?.[item.href] ?? 0;
              return (
                <li key={item.href}>
                  <Link
                    ref={active ? activeRef : undefined}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    aria-current={active ? "page" : undefined}
                    title={
                      count > 0 ? `${item.label} (${count} pendente(s))` : item.label
                    }
                    aria-label={
                      count > 0 ? `${item.label}, ${count} pendente(s)` : item.label
                    }
                    className={`flex min-h-[44px] items-center gap-3 rounded-mi px-3 font-corpo text-sm transition-colors md:justify-center lg:justify-start group-data-[collapsed=true]:lg:justify-center ${
                      active
                        ? "bg-mi-marrom text-mi-branco"
                        : "text-mi-texto hover:bg-mi-marrom/10"
                    }`}
                  >
                    <span className="relative shrink-0">
                      {item.icon}
                      {/* Trilho só-ícone (md, ou lg recolhido): ponto no canto */}
                      {count > 0 && (
                        <span
                          aria-hidden
                          className="absolute -right-1 -top-1 hidden h-2 w-2 rounded-full bg-mi-marrom ring-2 ring-mi-superficie-nav md:block lg:hidden group-data-[collapsed=true]:lg:block"
                        />
                      )}
                    </span>
                    <span className="inline flex-1 truncate md:hidden lg:inline group-data-[collapsed=true]:lg:hidden">
                      {item.label}
                    </span>
                    {/* Expandido: pílula com o número */}
                    {count > 0 && (
                      <span
                        className={`ml-auto inline min-w-[20px] rounded-full px-1.5 py-0.5 text-center font-corpo text-[11px] leading-none md:hidden lg:inline group-data-[collapsed=true]:lg:hidden ${
                          active
                            ? "bg-mi-branco text-mi-marrom"
                            : "bg-mi-marrom text-mi-branco"
                        }`}
                      >
                        {count}
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Rodapé: Sair */}
        <div className="border-t border-mi-cinza/60 p-2">
          <button
            type="button"
            onClick={() => signOut({ callbackUrl: "/admin/login" })}
            title="Sair"
            aria-label="Sair"
            className="flex min-h-[44px] w-full items-center gap-3 rounded-mi px-3 font-corpo text-sm text-mi-marrom transition-colors hover:bg-mi-marrom/10 md:justify-center lg:justify-start group-data-[collapsed=true]:lg:justify-center"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <path d="M16 17l5-5-5-5M21 12H9" />
            </svg>
            <span className="truncate inline md:hidden lg:inline group-data-[collapsed=true]:lg:hidden">
              Sair
            </span>
          </button>
        </div>
      </aside>
    </>
  );
}
