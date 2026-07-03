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
        className="mi-drawer-in absolute right-0 top-0 flex h-dvh w-[88%] max-w-sm flex-col bg-mi-bege shadow-suave"
      >
        {/* Header do drawer */}
        <div className="flex items-center justify-between border-b border-mi-cinza/60 py-3 pl-5 pr-3">
          <span className="leading-none">
            <span className="block font-titulo text-xl text-mi-marrom-escuro">
              Mi Ozorio
            </span>
            <span className="block font-corpo text-[10px] uppercase tracking-[0.25em] text-mi-marrom">
              Beauty Artist
            </span>
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

        {/* CTA principal — sempre visível, sem rolar (R19) */}
        <div className="border-b border-mi-cinza/60 p-4">
          <Link
            href="/agendar"
            onClick={() => setOpen(false)}
            className="flex min-h-[52px] items-center justify-center rounded-mi bg-mi-marrom px-4 font-corpo text-base text-mi-branco shadow-suave transition-colors hover:bg-mi-marrom-escuro"
          >
            Agendar meu horário
          </Link>
        </div>

        {/* Navegação */}
        <nav
          aria-label="Navegação principal"
          className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 py-4"
        >
          {NAV_LINKS.map((item) => (
            <NavLink
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className="flex min-h-[46px] items-center rounded-mi px-3 font-corpo text-base text-mi-texto transition-colors hover:bg-mi-cinza/40"
              activeClassName="bg-mi-cinza/40 font-medium text-mi-marrom-escuro"
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        {/* Contato discreto no rodapé do painel */}
        <div className="border-t border-mi-cinza/60 px-6 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4 font-corpo text-sm text-mi-texto/80">
          <a
            href={WA_LINK}
            target="_blank"
            rel="noopener noreferrer"
            className="block min-h-[44px] leading-[44px] transition-colors hover:text-mi-marrom-escuro"
          >
            WhatsApp (21) 97022-5231
          </a>
          <a
            href="https://instagram.com/mileneozorio"
            target="_blank"
            rel="noopener noreferrer"
            className="block min-h-[44px] leading-[44px] transition-colors hover:text-mi-marrom-escuro"
          >
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
