import Link from "next/link";
import type { ComponentPropsWithoutRef, ReactNode } from "react";

/**
 * Pílula de ação rápida / seleção (V0). Ativa: marrom com texto branco;
 * inativa: branco com borda cinza. Alvo ≥44px (R19). Sem hooks.
 */
type ChipProps = {
  ativo?: boolean;
  href?: string;
  children: ReactNode;
  className?: string;
} & Omit<ComponentPropsWithoutRef<"button">, "className">;

export default function Chip({
  ativo = false,
  href,
  children,
  className = "",
  ...rest
}: ChipProps) {
  const classes = `inline-flex min-h-[44px] items-center justify-center whitespace-nowrap rounded-full px-5 font-corpo text-sm transition-colors ${
    ativo
      ? "bg-mi-marrom text-mi-branco shadow-suave"
      : "border border-mi-cinza bg-mi-branco text-mi-texto hover:border-mi-marrom"
  } disabled:cursor-not-allowed disabled:border-mi-cinza disabled:text-mi-texto/40 ${className}`;
  if (href) {
    return (
      <Link href={href} className={classes} aria-current={ativo ? "true" : undefined}>
        {children}
      </Link>
    );
  }
  return (
    <button
      type="button"
      className={classes}
      aria-pressed={ativo}
      {...rest}
    >
      {children}
    </button>
  );
}
