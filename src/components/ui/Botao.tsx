import Link from "next/link";
import type { ComponentPropsWithoutRef, ReactNode } from "react";

/**
 * Botão padrão da marca (V0). Alvo mínimo 52px (R19). Sem hooks — usável em
 * server e client components. Com `href` vira Link (externo se http).
 */
type Variante = "primario" | "secundario" | "whatsapp";

const BASE =
  "inline-flex min-h-[52px] items-center justify-center gap-2 rounded-mi px-7 font-corpo text-base transition-colors disabled:cursor-not-allowed disabled:bg-mi-marrom-suave disabled:text-mi-branco";

const VARIANTES: Record<Variante, string> = {
  // Branco sobre #8A7361 = 4,46:1 — reprova AA por 0,9%. É o botão principal
  // do site inteiro: o fundo vira o escuro (8,39:1) e o claro vira o hover.
  primario:
    "bg-mi-marrom-escuro text-mi-branco shadow-suave hover:bg-mi-marrom",
  secundario:
    "border border-mi-marrom text-mi-marrom-escuro hover:bg-mi-cinza",
  whatsapp:
    "bg-mi-marrom-escuro text-mi-branco shadow-suave hover:bg-mi-texto",
};

type BotaoProps = {
  variante?: Variante;
  href?: string;
  children: ReactNode;
  className?: string;
} & Omit<ComponentPropsWithoutRef<"button">, "className">;

export default function Botao({
  variante = "primario",
  href,
  children,
  className = "",
  ...rest
}: BotaoProps) {
  const classes = `${BASE} ${VARIANTES[variante]} ${className}`;
  if (href) {
    const externo = href.startsWith("http");
    return (
      <Link
        href={href}
        className={classes}
        {...(externo ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      >
        {children}
      </Link>
    );
  }
  return (
    <button className={classes} {...rest}>
      {children}
    </button>
  );
}
