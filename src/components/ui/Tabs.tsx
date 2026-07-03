import Link from "next/link";

/**
 * Tabs com sublinhado fino marrom e scroll horizontal (V0). Sem hooks:
 * navegação por Link (server) ou onSelect (dentro de client components).
 * Zero jargão nos rótulos (R13) — quem usa passa os nomes prontos.
 */
export type TabItem = {
  id: string;
  label: string;
  href?: string;
};

type TabsProps = {
  items: TabItem[];
  ativo: string;
  onSelect?: (id: string) => void;
  ariaLabel: string;
};

export default function Tabs({ items, ativo, onSelect, ariaLabel }: TabsProps) {
  return (
    <nav
      aria-label={ariaLabel}
      className="mi-carrossel -mx-5 border-b border-mi-cinza px-5"
    >
      {items.map((item) => {
        const isAtivo = item.id === ativo;
        const classes = `relative -mb-px shrink-0 border-b-2 px-1 pb-3 pt-2 font-corpo text-sm transition-colors ${
          isAtivo
            ? "border-mi-marrom font-normal text-mi-marrom-escuro"
            : "border-transparent text-mi-texto/60 hover:text-mi-marrom-escuro"
        }`;
        if (item.href) {
          return (
            <Link
              key={item.id}
              href={item.href}
              className={classes}
              aria-current={isAtivo ? "page" : undefined}
            >
              {item.label}
            </Link>
          );
        }
        return (
          <button
            key={item.id}
            type="button"
            className={classes}
            aria-pressed={isAtivo}
            onClick={onSelect ? () => onSelect(item.id) : undefined}
          >
            {item.label}
          </button>
        );
      })}
    </nav>
  );
}
