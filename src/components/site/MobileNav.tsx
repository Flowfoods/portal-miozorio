"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { NAV_LINKS } from "./navLinks";
import NavLink from "./NavLink";

/**
 * Navegação mobile (< 640px): botão hambúrguer rotulado + drawer acessível.
 * Desktop (≥ 640px) usa a <nav> do Header; aqui tudo é `sm:hidden`.
 *
 * Acessibilidade: button com aria-label/expanded/controls; drawer com
 * role="dialog" + aria-modal; focus trap; Esc/backdrop/clique-no-link fecham;
 * foco volta pro botão; scroll do body travado; respeita prefers-reduced-motion.
 */
export default function MobileNav() {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Trava o scroll do body enquanto aberto (evita rolar a página atrás).
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Esc fecha; Tab fica preso no drawer; foca o 1º item ao abrir.
  useEffect(() => {
    if (!open) return;
    const getFocusables = () =>
      Array.from(
        panelRef.current?.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled])',
        ) ?? [],
      );

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        closeAndRestore();
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

  // Fecha devolvendo o foco ao botão (Esc / backdrop / botão fechar).
  function closeAndRestore() {
    setOpen(false);
    btnRef.current?.focus();
  }

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Abrir menu"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls="mobile-nav"
        className="inline-flex h-11 w-11 items-center justify-center rounded-mi text-mi-marrom-escuro transition-colors hover:bg-mi-cinza/50 sm:hidden"
      >
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          aria-hidden="true"
        >
          <line x1="3" y1="6" x2="21" y2="6" />
          <line x1="3" y1="12" x2="21" y2="12" />
          <line x1="3" y1="18" x2="21" y2="18" />
        </svg>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 sm:hidden">
          {/* Backdrop */}
          <div
            onClick={closeAndRestore}
            aria-hidden="true"
            className="mi-fade-in absolute inset-0 bg-mi-marrom-escuro/40 backdrop-blur-sm"
          />

          {/* Sheet */}
          <div
            id="mobile-nav"
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label="Menu de navegação"
            className="mi-drawer-in absolute right-0 top-0 flex h-full w-[82%] max-w-xs flex-col bg-mi-bege shadow-suave"
          >
            <div className="flex items-center justify-between border-b border-mi-cinza/60 px-5 py-3">
              <span className="font-titulo text-lg text-mi-marrom-escuro">
                Menu
              </span>
              <button
                type="button"
                onClick={closeAndRestore}
                aria-label="Fechar menu"
                className="inline-flex h-11 w-11 items-center justify-center rounded-mi text-mi-marrom-escuro transition-colors hover:bg-mi-cinza/50"
              >
                <svg
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  aria-hidden="true"
                >
                  <line x1="6" y1="6" x2="18" y2="18" />
                  <line x1="18" y1="6" x2="6" y2="18" />
                </svg>
              </button>
            </div>

            <nav
              aria-label="Navegação principal"
              className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 py-4"
            >
              {NAV_LINKS.map((item) => (
                <NavLink
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className="flex min-h-[44px] items-center rounded-mi px-3 font-corpo text-base text-mi-texto transition-colors hover:bg-mi-cinza/40"
                  activeClassName="bg-mi-cinza/40 font-medium text-mi-marrom-escuro"
                >
                  {item.label}
                </NavLink>
              ))}
            </nav>

            <div className="border-t border-mi-cinza/60 p-4">
              <Link
                href="/agendar"
                onClick={() => setOpen(false)}
                className="flex min-h-[48px] items-center justify-center rounded-mi bg-mi-marrom px-4 font-corpo text-base text-mi-branco transition-colors hover:bg-mi-marrom-escuro"
              >
                Agendar meu horário
              </Link>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
