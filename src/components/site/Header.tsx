import Link from "next/link";

const NAV = [
  { href: "/#servicos", label: "Serviços" },
  { href: "/dia-a-dia", label: "Dia a dia" },
  { href: "/noivas", label: "Noivas" },
  { href: "/debutantes", label: "Debutantes" },
  { href: "/clube", label: "Clube" },
  { href: "/sobre", label: "Sobre" },
];

export default function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-mi-cinza/60 bg-mi-bege/80 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-3">
        <Link href="/" className="leading-none">
          <span className="block font-titulo text-xl text-mi-marrom-escuro">
            Mi Ozorio
          </span>
          <span className="block font-corpo text-[10px] uppercase tracking-[0.25em] text-mi-marrom">
            Beauty Artist
          </span>
        </Link>

        <nav className="hidden items-center gap-7 sm:flex">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="font-corpo text-sm text-mi-texto transition-colors hover:text-mi-marrom-escuro"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <Link
          href="/agendar"
          className="inline-flex min-h-[40px] items-center rounded-mi bg-mi-marrom px-4 font-corpo text-sm text-mi-branco transition-colors hover:bg-mi-marrom-escuro"
        >
          Agendar
        </Link>
      </div>
    </header>
  );
}
