import Image from "next/image";
import Link from "next/link";
import Estrelas from "@/components/ui/Estrelas";
import type { VitrineHistoria } from "@/lib/testimonials";

/**
 * Vitrine "Histórias de clientes" (F4): prova social emocional — foto real,
 * primeiro nome + inicial, serviço e nota, com micro-CTA de agendamento em
 * cada card. Renderiza nada se não houver histórias (só conteúdo autorizado).
 * Carrossel no mobile, grid no desktop.
 */
export default function HistoriasClientes({
  historias,
}: {
  historias: VitrineHistoria[];
}) {
  if (historias.length === 0) return null;

  return (
    <section className="bg-mi-superficie-nav py-16">
      <div className="mx-auto max-w-5xl px-5">
        <header className="mb-10 text-center">
          <h2 className="font-titulo text-4xl text-mi-marrom-escuro">
            Histórias de clientes
          </h2>
          <p className="mt-2 font-corpo text-mi-marrom">
            Momentos reais de quem se cuidou com a Mi 💛
          </p>
        </header>

        <ul className="mi-carrossel -mx-5 px-5 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 lg:grid-cols-3">
          {historias.map((h) => (
            <li
              key={h.id}
              className="flex w-[82vw] max-w-[320px] shrink-0 flex-col overflow-hidden rounded-mi border border-mi-cinza bg-mi-branco shadow-suave sm:w-auto sm:max-w-none"
            >
              <div className="relative aspect-[4/5] w-full overflow-hidden bg-mi-bege">
                <Image
                  src={`/momentos/foto/${h.fotos[0]!.id}`}
                  alt={`Trabalho da Mi Ozorio — ${h.servico ?? "atendimento"}`}
                  fill
                  unoptimized
                  loading="lazy"
                  sizes="(max-width: 640px) 82vw, 320px"
                  className="object-cover"
                />
              </div>
              <figure className="flex flex-1 flex-col p-5">
                {h.rating && <Estrelas nota={h.rating} className="mb-2" />}
                <blockquote className="flex-1 font-titulo text-lg italic leading-snug text-mi-texto">
                  “{h.quote}”
                </blockquote>
                <figcaption className="mt-3 font-corpo text-sm text-mi-marrom">
                  {h.author}
                  {h.servico && (
                    <span className="text-mi-texto/50"> · {h.servico}</span>
                  )}
                </figcaption>
                <Link
                  href="/agendar"
                  className="mt-4 inline-flex font-corpo text-sm text-mi-marrom underline-offset-4 transition-colors hover:text-mi-marrom-escuro hover:underline"
                >
                  Quero viver isso ›
                </Link>
              </figure>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
