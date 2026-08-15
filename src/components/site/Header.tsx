import Link from "next/link";
import { NAV_LINKS } from "./navLinks";
import NavLink from "./NavLink";
import MobileNav from "./MobileNav";

export default function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-mi-cinza/60 bg-mi-bege/80 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-3">
        <Link href="/" className="leading-none" aria-label="Mi Ozorio — página inicial">
          <span className="block font-titulo text-xl text-mi-marrom-escuro">
            Mi Ozorio
          </span>
          <span className="block font-corpo text-[10px] uppercase tracking-[0.25em] text-mi-marrom-escuro">
            Beauty Artist
          </span>
        </Link>

        <nav
          aria-label="Navegação principal"
          className="hidden items-center gap-7 sm:flex"
        >
          {NAV_LINKS.map((item) => (
            <NavLink
              key={item.href}
              href={item.href}
              className="font-corpo text-sm text-mi-texto transition-colors hover:text-mi-marrom-escuro"
              activeClassName="text-mi-marrom-escuro underline decoration-mi-marrom decoration-[1.5px] underline-offset-8"
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="flex items-center gap-1.5">
          <Link
            href="/agendar"
            className="inline-flex min-h-[40px] items-center rounded-mi bg-mi-marrom px-4 font-corpo text-sm text-mi-branco transition-colors hover:bg-mi-marrom-escuro"
          >
            Agendar
          </Link>
          <MobileNav />
        </div>
      </div>
    </header>
  );
}
