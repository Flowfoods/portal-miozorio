"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { NAV_LINKS } from "./navLinks";
import NavLink from "./NavLink";

/**
 * Navegação mobile (< 640px): botão hambúrguer + drawer acessível.
 * Desktop (≥ 640px) usa a <nav> do Header; aqui tudo é `sm:hidden`.
 *
 * ⚠️ O drawer é renderizado via PORTAL no <body>, nunca dentro do <header>:
 * o header tem `backdrop-blur`, e no iOS Safari `backdrop-filter` cria um
 * containing block para descendentes `position: fixed` — o drawer ficava
 * preso na caixa do header (links invisíveis, CTA solto sobre a página).
 * Pelo mesmo motivo o overlay NÃO usa backdrop-blur.
 *
 * Scroll lock à prova de iOS: `overflow: hidden` no body é ignorado pelo
 * Safari mobile; usamos body position:fixed + restauração do scroll.
 *
 * Acessibilidade: button com aria-label/expanded/controls; drawer com
 * role="dialog" + aria-modal; focus trap; Esc/overlay/clique-no-link fecham;
 * foco volta pro botão; respeita prefers-reduced-motion (globals.css).
 */
const WA_LINK =
  "https://wa.me/5521970225231?text=Oi%20Mi!%20Vim%20pelo%20site%20e%20quero%20tirar%20uma%20d%C3%BAvida";

export default function MobileNav() {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Trava o scroll do body enquanto aberto — técnica position:fixed
  // (iOS Safari ignora overflow:hidden no body).
  useEffect(() => {
    if (!open) return;
    const body = document.body;
    const scrollY = window.scrollY;
    const prev = {
      position: body.style.position,
      top: body.style.top,
      left: body.style.left,
      right: body.style.right,
      width: body.style.width,
    };
    body.style.position = "fixed";
    body.style.top = `-${scrollY}px`;
    body.style.left = "0";
    body.style.right = "0";
    body.style.width = "100%";
    return () => {
      body.style.position = prev.position;
      body.style.top = prev.top;
      body.style.left = prev.left;
      body.style.right = prev.right;
      body.style.width = prev.width;
      window.scrollTo(0, scrollY);
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

  // Fecha devolvendo o foco ao botão (Esc / overlay / X / link).
  function closeAndRestore() {
    setOpen(false);
    btnRef.current?.focus();
  }

  const drawer = (
    <div className="fixed inset-0 z-[70] sm:hidden">
      {/* Overlay — sólido (sem backdrop-blur: quebra no iOS); clique fecha */}
      <div
        onClick={closeAndRestore}
        aria-hidden="true"
        className="mi-fade-in absolute inset-0 bg-mi-marrom-escuro/50"
      />

      {/* Painel */}
      <div
        id="mobile-nav"
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Menu de navegação"
        className="mi-drawer-in absolute right-0 top-0 flex h-dvh w-[86%] max-w-[360px] flex-col overflow-hidden rounded-l-2xl bg-mi-bege shadow-[-12px_0_40px_rgb(0_0_0/0.18)]"
      >
        {/* Monograma marca-d'água */}
        <span
          aria-hidden
          className="pointer-events-none absolute -bottom-8 -right-4 select-none font-titulo text-[11rem] font-medium italic leading-none text-mi-marrom/[0.05]"
        >
          Mi
        </span>

        {/* Header do drawer */}
        <div className="flex items-center justify-between py-5 pl-7 pr-4">
          <span className="leading-none">
            <span className="block font-titulo text-2xl text-mi-marrom-escuro">
              Mi Ozorio
            </span>
            <span className="mt-1.5 block font-corpo text-[10px] uppercase tracking-[0.3em] text-mi-marrom">
              Beauty Artist
            </span>
          </span>
          <button
            type="button"
            onClick={closeAndRestore}
            aria-label="Fechar menu"
            className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-mi-cinza bg-mi-branco/60 text-mi-marrom-escuro transition-colors hover:bg-mi-branco"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <line x1="6" y1="6" x2="18" y2="18" />
              <line x1="18" y1="6" x2="6" y2="18" />
            </svg>
          </button>
        </div>

        {/* CTA principal — sempre visível, sem rolar (R19) */}
        <div className="px-7 pb-2">
          <Link
            href="/agendar"
            onClick={() => setOpen(false)}
            className="flex min-h-[54px] items-center justify-center gap-2 rounded-mi bg-mi-marrom font-corpo text-[15px] tracking-[0.06em] text-mi-branco shadow-suave transition-colors hover:bg-mi-marrom-escuro"
          >
            Agendar meu horário
            <span aria-hidden className="text-lg leading-none">
              ›
            </span>
          </Link>
        </div>

        {/* Navegação — editorial: serif grande, numeração discreta */}
        <nav
          aria-label="Navegação principal"
          className="mi-scroll relative flex-1 overflow-y-auto px-7 pt-3"
        >
          <ul className="divide-y divide-mi-cinza/50">
            {NAV_LINKS.map((item, i) => (
              <li
                key={item.href}
                className="mi-item-in"
                style={{ animationDelay: `${80 + i * 40}ms` }}
              >
                {/* Feedback de toque: fundo acende, nome desliza, seta aparece
                    (hover no desktop, :active no dedo — iOS). */}
                <NavLink
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className="group -mx-3 flex min-h-[52px] items-center justify-between gap-3 rounded-mi px-3 py-1 text-mi-marrom-escuro transition-colors duration-150 [-webkit-tap-highlight-color:transparent] hover:bg-mi-branco/80 hover:text-mi-marrom active:bg-mi-branco active:text-mi-marrom"
                  activeClassName="italic text-mi-marrom"
                >
                  <span className="font-titulo text-[25px] leading-tight transition-transform duration-150 group-hover:translate-x-1.5 group-active:translate-x-1.5">
                    {item.label}
                  </span>
                  <span
                    aria-hidden
                    className="text-xl leading-none text-mi-marrom opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-active:opacity-100"
                  >
                    ›
                  </span>
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        {/* Contato — rótulo + ícones, discreto */}
        <div className="relative border-t border-mi-cinza/60 px-7 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-5">
          <p className="font-corpo text-[10px] uppercase tracking-[0.25em] text-mi-marrom">
            Contato
          </p>
          <a
            href={WA_LINK}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 flex min-h-[44px] items-center gap-2.5 font-corpo text-sm text-mi-texto/80 transition-colors hover:text-mi-marrom-escuro"
          >
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="currentColor"
              aria-hidden="true"
              className="shrink-0 text-mi-marrom"
            >
              <path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38a9.9 9.9 0 0 0 4.79 1.22h.01c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2Zm5.8 14.16c-.24.68-1.42 1.32-1.95 1.36-.5.05-.96.23-3.24-.68-2.74-1.08-4.49-3.88-4.62-4.06-.14-.18-1.11-1.47-1.11-2.81 0-1.33.7-1.99.95-2.26.24-.27.53-.34.71-.34l.51.01c.16.01.39-.06.6.46.24.57.81 1.96.88 2.1.07.14.12.3.02.48-.09.18-.14.3-.27.46-.14.16-.29.36-.41.48-.14.14-.28.29-.12.57.16.27.71 1.18 1.53 1.91 1.05.94 1.94 1.23 2.21 1.37.27.14.43.12.59-.07.16-.18.68-.79.86-1.07.18-.27.36-.22.6-.13.24.09 1.55.73 1.81.87.27.14.45.2.51.31.07.11.07.63-.17 1.31Z" />
            </svg>
            (21) 97022-5231
          </a>
          <a
            href="https://instagram.com/mileneozorio"
            target="_blank"
            rel="noopener noreferrer"
            className="flex min-h-[44px] items-center gap-2.5 font-corpo text-sm text-mi-texto/80 transition-colors hover:text-mi-marrom-escuro"
          >
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              aria-hidden="true"
              className="shrink-0 text-mi-marrom"
            >
              <rect x="3" y="3" width="18" height="18" rx="5" />
              <circle cx="12" cy="12" r="4" />
              <circle cx="17.2" cy="6.8" r="0.8" fill="currentColor" stroke="none" />
            </svg>
            @mileneozorio
          </a>
        </div>
      </div>
    </div>
  );

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

      {/* Portal: drawer no <body>, fora do containing block do header */}
      {open && createPortal(drawer, document.body)}
    </>
  );
}
