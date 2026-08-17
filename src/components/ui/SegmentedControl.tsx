import Link from "next/link";

/**
 * Controle segmentado em pílula (Semana / Mês / Ano...). Server-friendly:
 * cada opção é um Link (filtro via querystring), ativo em marrom-700 com
 * texto branco. Alvo de toque ≥ 44px (py + min-h do item).
 */
export type SegmentedItem = {
  label: string;
  href: string;
  ativo: boolean;
};

export default function SegmentedControl({
  items,
  ariaLabel,
  className = "",
}: {
  items: SegmentedItem[];
  ariaLabel: string;
  className?: string;
}) {
  return (
    <nav
      aria-label={ariaLabel}
      className={`inline-flex max-w-full items-center gap-1 overflow-x-auto rounded-full border border-mi-marrom-100 bg-mi-branco p-1 shadow-card ${className}`}
    >
      {items.map((it) => (
        <Link
          key={it.href}
          href={it.href}
          aria-current={it.ativo ? "page" : undefined}
          className={`inline-flex min-h-[36px] shrink-0 items-center rounded-full px-4 font-corpo text-rotulo transition-colors ${
            it.ativo
              ? "bg-mi-marrom-700 font-medium text-mi-branco"
              : "text-mi-marrom-800 hover:bg-mi-marrom-50"
          }`}
        >
          {it.label}
        </Link>
      ))}
    </nav>
  );
}
