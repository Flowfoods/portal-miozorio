import Link from "next/link";
import Image from "next/image";
import { JsonLd } from "@/components/seo/JsonLd";
import { beautySalonSchema, pageMeta, reviewSchema } from "@/lib/seo";
import { getPublishedMedia } from "@/lib/media";
import {
  getPublishedTestimonials,
  getVitrineTestimonials,
  getTestimonialsAggregate,
} from "@/lib/testimonials";
import { getSiteContent, parseServicos, parseTabela } from "@/lib/content";
import MonogramPlaceholder from "@/components/site/MonogramPlaceholder";
import HistoriasClientes from "@/components/site/HistoriasClientes";
import Botao from "@/components/ui/Botao";
import CardServico from "@/components/ui/CardServico";

// ISR: as fotos vêm do banco (media_assets). Mudanças no painel chamam
// revalidatePath("/") e aparecem na hora; 1h é só o teto de segurança.
export const revalidate = 3600;

export const metadata = pageMeta({
  path: "/",
  title: "Milene Ozorio · Beauty Artist · Maquiagem e penteado RJ",
  description:
    "Maquiagem e penteado para noivas, debutantes e festas no Rio de Janeiro. Agendamento online com a maquiadora Milene Ozorio.",
  ogTitle: "Maquiagem & Penteado no RJ",
});

export default async function Home() {
  const [heroFoto] = await getPublishedMedia("hero", 1);
  const portfolio = await getPublishedMedia("portfolio", 6);
  const depoimentos = await getPublishedTestimonials(6);
  const historias = await getVitrineTestimonials(9);
  const agregado = await getTestimonialsAggregate();
  const content = await getSiteContent();
  const servicos = parseServicos(content["home.servicos.lista"] ?? "");
  const diferenciais = parseTabela(content["home.diferenciais.lista"] ?? "");
  const reviews = reviewSchema(
    agregado,
    historias.map((h) => ({ autor: h.author, nota: h.rating, texto: h.quote })),
  );
  return (
    <main>
      <JsonLd data={beautySalonSchema} />
      {reviews && <JsonLd data={reviews} />}
      {/* HERO */}
      <section className="mx-auto grid max-w-5xl items-center gap-10 px-5 py-16 sm:py-24 md:grid-cols-2">
        <div>
          <p className="flex items-center gap-3 font-corpo text-xs uppercase tracking-[0.3em] text-mi-marrom-escuro">
            <span aria-hidden className="h-px w-8 bg-mi-marrom" />
            {content["home.hero.eyebrow"]}
          </p>
          <h1 className="mt-5 text-balance font-titulo text-5xl leading-[1.05] text-mi-marrom-escuro sm:text-6xl">
            {content["home.hero.title"]}
          </h1>
          <p className="mt-5 max-w-md font-corpo text-lg font-light text-mi-texto">
            {content["home.hero.subtitle"]}
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Botao href="/agendar">{content["home.hero.cta_primary"]}</Botao>
            <Botao href="/#especiais" variante="secundario">
              {content["home.hero.cta_secondary"]}
            </Botao>
          </div>
        </div>

        <div className="relative aspect-[4/5] w-full overflow-hidden rounded-mi bg-mi-bege shadow-suave">
          {heroFoto ? (
            <Image
              src={heroFoto.url}
              alt={heroFoto.alt}
              fill
              priority
              sizes="(max-width: 768px) 100vw, 480px"
              className="object-cover"
            />
          ) : (
            <MonogramPlaceholder />
          )}
        </div>
      </section>

      {/* SERVIÇOS */}
      <section id="servicos" className="mx-auto max-w-5xl px-5 py-16">
        <header className="mb-10 text-center">
          <h2 className="font-titulo text-4xl text-mi-marrom-escuro">
            {content["home.servicos.title"]}
          </h2>
          <p className="mt-2 font-corpo text-mi-marrom">
            {content["home.servicos.subtitle"]}
          </p>
        </header>
        {/* Carrossel no mobile (scroll-snap), grid a partir de sm. */}
        <div className="mi-carrossel -mx-5 px-5 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 lg:grid-cols-3">
          {servicos.map((s) => (
            <div
              key={s.nome}
              className="w-[72vw] max-w-[280px] shrink-0 sm:w-auto sm:max-w-none"
            >
              <CardServico
                nome={s.nome}
                descricao={s.desc}
                preco={s.preco}
                href="/agendar"
              />
            </div>
          ))}
        </div>
      </section>

      {/* DIFERENCIAIS */}
      <section className="bg-mi-branco/50 py-16">
        <div className="mx-auto max-w-5xl px-5">
          <header className="mb-10 text-center">
            <h2 className="font-titulo text-4xl text-mi-marrom-escuro">
              {content["home.diferenciais.title"]}
            </h2>
          </header>
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {diferenciais.map((d) => (
              <div key={d.o}>
                <h3 className="font-titulo text-xl text-mi-marrom-escuro">
                  {d.o}
                </h3>
                <p className="mt-2 font-corpo text-sm text-mi-texto">{d.v}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PORTFÓLIO */}
      <section className="mx-auto max-w-5xl px-5 py-16">
        <header className="mb-10 text-center">
          <h2 className="font-titulo text-4xl text-mi-marrom-escuro">
            {content["home.portfolio.title"]}
          </h2>
          <p className="mt-2 font-corpo text-mi-marrom">
            {content["home.portfolio.subtitle"]}
          </p>
        </header>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {portfolio.length > 0
            ? portfolio.map((foto) => (
                <div
                  key={foto.id}
                  className="relative aspect-[4/5] overflow-hidden rounded-mi bg-mi-bege"
                >
                  <Image
                    src={foto.url}
                    alt={foto.alt}
                    fill
                    loading="lazy"
                    sizes="(max-width: 640px) 50vw, 320px"
                    className="object-cover"
                  />
                </div>
              ))
            : Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="aspect-[4/5] overflow-hidden rounded-mi"
                >
                  <MonogramPlaceholder />
                </div>
              ))}
        </div>
      </section>

      {/* HISTÓRIAS DE CLIENTES (F4) — vitrine com foto; some quando vazia */}
      <HistoriasClientes historias={historias} />

      {/* DEPOIMENTOS */}
      <section className="bg-mi-branco/50 py-16">
        <div className="mx-auto max-w-5xl px-5">
          <header className="mb-10 text-center">
            <h2 className="font-titulo text-4xl text-mi-marrom-escuro">
              {content["home.depoimentos.title"]}
            </h2>
          </header>
          <div className="mi-carrossel -mx-5 px-5 sm:mx-0 sm:grid sm:grid-cols-3 sm:overflow-visible sm:px-0">
            {depoimentos.map((d, i) => (
              <figure
                key={i}
                className="w-[78vw] max-w-[320px] shrink-0 rounded-mi border border-mi-cinza bg-mi-branco p-6 shadow-suave sm:w-auto sm:max-w-none"
              >
                <span
                  aria-hidden
                  className="block font-titulo text-5xl leading-none text-mi-marrom/30"
                >
                  “
                </span>
                <blockquote className="mt-1 font-titulo text-lg italic text-mi-texto">
                  {d.quote}
                </blockquote>
                <figcaption className="mt-4 font-corpo text-sm text-mi-marrom-escuro">
                  {d.author}
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      {/* ESPECIAIS — noivas e debutantes */}
      <section id="especiais" className="mx-auto max-w-5xl px-5 py-16">
        <header className="mb-10 text-center">
          <h2 className="font-titulo text-4xl text-mi-marrom-escuro">
            {content["home.especiais.title"]}
          </h2>
          <p className="mt-2 font-corpo text-mi-marrom">
            {content["home.especiais.subtitle"]}
          </p>
        </header>
        <div className="grid gap-6 sm:grid-cols-2">
          {[
            {
              titulo: "La Mariée",
              sub: "Para noivas",
              desc: content["home.especiais.noivas.desc"],
              href: "/noivas",
            },
            {
              titulo: "Debutantes",
              sub: "Para os 15 anos",
              desc: content["home.especiais.debutantes.desc"],
              href: "/debutantes",
            },
          ].map((c) => (
            <Link
              key={c.href}
              href={c.href}
              className="group relative overflow-hidden rounded-mi border border-mi-cinza bg-mi-branco p-8 shadow-suave transition-colors hover:border-mi-marrom"
            >
              <span className="inline-block rounded-full bg-mi-bege px-3 py-1 font-corpo text-[11px] uppercase tracking-[0.15em] text-mi-marrom-escuro">
                Atendimento exclusivo
              </span>
              <p className="mt-4 font-corpo text-xs uppercase tracking-[0.25em] text-mi-marrom-escuro">
                {c.sub}
              </p>
              <h3 className="mt-2 font-titulo text-3xl text-mi-marrom-escuro">
                {c.titulo}
              </h3>
              <p className="mt-3 font-corpo text-sm text-mi-texto">{c.desc}</p>
              <span className="mt-5 inline-block font-corpo text-sm text-mi-marrom-escuro group-hover:text-mi-marrom-escuro">
                Ver mais ›
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* CTA FINAL — faixa quente para fechar a página */}
      <section className="bg-mi-superficie-nav">
        <div className="mx-auto max-w-3xl px-5 py-20 text-center">
          <h2 className="text-balance font-titulo text-4xl text-mi-marrom-escuro sm:text-5xl">
            {content["home.cta.title"]}
          </h2>
          <p className="mx-auto mt-4 max-w-md font-corpo text-mi-texto">
            {content["home.cta.subtitle"]}
          </p>
          <Botao href="/agendar" className="mt-8">
            {content["home.cta.button"]}
          </Botao>
        </div>
      </section>
    </main>
  );
}
