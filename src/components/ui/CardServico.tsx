import Link from "next/link";
import Image from "next/image";
import MonogramPlaceholder from "@/components/site/MonogramPlaceholder";

/**
 * Card de serviço com foto 4:5, nome (Cormorant) e preço (Jost) — padrão do
 * guia visual (V0). `vitrine` troca o CTA para WhatsApp: noiva/debutante NUNCA
 * têm botão de agendar (R1/R14). Sem foto → monograma (nunca "foto 1", R12).
 */
type CardServicoProps = {
  nome: string;
  preco?: string;
  descricao?: string;
  foto?: { url: string; alt: string };
  href: string;
  vitrine?: boolean;
  selo?: string;
};

export default function CardServico({
  nome,
  preco,
  descricao,
  foto,
  href,
  vitrine = false,
  selo,
}: CardServicoProps) {
  const externo = href.startsWith("http");
  return (
    <Link
      href={href}
      {...(externo ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      className="group flex w-full flex-col overflow-hidden rounded-mi border border-mi-cinza bg-mi-branco shadow-suave transition-colors hover:border-mi-marrom"
    >
      <div className="relative aspect-[4/5] w-full overflow-hidden bg-mi-bege">
        {foto ? (
          <Image
            src={foto.url}
            alt={foto.alt}
            fill
            loading="lazy"
            sizes="(max-width: 640px) 75vw, 320px"
            className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          />
        ) : (
          <MonogramPlaceholder />
        )}
        {selo ? (
          <span className="absolute left-3 top-3 rounded-full bg-mi-bege/90 px-3 py-1 font-corpo text-[11px] uppercase tracking-[0.15em] text-mi-marrom-escuro backdrop-blur">
            {selo}
          </span>
        ) : null}
      </div>
      <div className="flex flex-1 flex-col p-5">
        <h3 className="font-titulo text-2xl text-mi-marrom-escuro">{nome}</h3>
        {descricao ? (
          <p className="mt-1 flex-1 font-corpo text-sm text-mi-texto">
            {descricao}
          </p>
        ) : null}
        <div className="mt-4 flex items-center justify-between gap-2">
          {preco ? (
            <p className="font-corpo text-sm font-medium text-mi-marrom-escuro">
              {preco}
            </p>
          ) : (
            <span />
          )}
          <span className="font-corpo text-sm text-mi-marrom-escuro group-hover:text-mi-marrom-escuro">
            {vitrine ? "Solicitar proposta ›" : "Agendar ›"}
          </span>
        </div>
      </div>
    </Link>
  );
}
