import Link from "next/link";
import Image from "next/image";
import { JsonLd } from "@/components/seo/JsonLd";
import { beautySalonSchema, pageMeta } from "@/lib/seo";
import { getPublishedMedia } from "@/lib/media";
import { getPublishedTestimonials } from "@/lib/testimonials";
import { getSiteContent, parseServicos, parseTabela } from "@/lib/content";
import MonogramPlaceholder from "@/components/site/MonogramPlaceholder";

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
  const content = await getSiteContent();
  const servicos = parseServicos(content["home.servicos.lista"] ?? "");
  const diferenciais = parseTabela(content["home.diferenciais.lista"] ?? "");
  return (
    <main>
      <JsonLd data={beautySalonSchema} />
      {/* HERO */}
      <section className="mx-auto grid max-w-5xl items-center gap-10 px-5 py-16 sm:py-24 md:grid-cols-2">
        <div>
          <p className="font-corpo text-xs uppercase tracking-[0.3em] text-mi-marrom">
            {content["home.hero.eyebrow"]}
          </p>
          <h1 className="mt-5 text-balance font-titulo text-5xl leading-[1.05] text-mi-marrom-escuro sm:text-6xl">
            {content["home.hero.title"]}
          </h1>
          <p className="mt-5 max-w-md font-corpo text-lg font-light text-mi-texto">
            {content["home.hero.subtitle"]}
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/agendar"
              className="inline-flex min-h-[52px] items-center justify-center rounded-mi bg-mi-marrom px-7 font-corpo text-base text-mi-branco shadow-suave transition-colors hover:bg-mi-marrom-escuro"
            >
              {content["home.hero.cta_primary"]}
            </Link>
            <Link
              href="/#especiais"
              className="inline-flex min-h-[52px] items-center justify-center rounded-mi border border-mi-marrom px-7 font-corpo text-base text-mi-marrom-escuro transition-colors hover:bg-mi-cinza"
            >
              {content["home.hero.cta_secondary"]}
            </Link>
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
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {servicos.map((s) => (
            <Link
              key={s.nome}
              href="/agendar"
              className="group flex flex-col rounded-mi border border-mi-cinza bg-mi-branco p-6 shadow-suave transition-colors hover:border-mi-marrom"
            >
              <h3 className="font-titulo text-2xl text-mi-marrom-escuro">
                {s.nome}
              </h3>
              <p className="mt-2 flex-1 font-corpo text-sm text-mi-texto">
                {s.desc}
              </p>
              <p className="mt-4 font-corpo text-sm font-medium text-mi-marrom">
                {s.preco}
              </p>
            </Link>
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

      {/* DEPOIMENTOS */}
      <section className="bg-mi-branco/50 py-16">
        <div className="mx-auto max-w-5xl px-5">
          <header className="mb-10 text-center">
            <h2 className="font-titulo text-4xl text-mi-marrom-escuro">
              {content["home.depoimentos.title"]}
            </h2>
          </header>
          <div className="grid gap-6 sm:grid-cols-3">
            {depoimentos.map((d, i) => (
              <figure
                key={i}
                className="rounded-mi border border-mi-cinza bg-mi-branco p-6 shadow-suave"
              >
                <blockquote className="font-corpo text-mi-texto">
                  “{d.quote}”
                </blockquote>
                <figcaption className="mt-4 font-corpo text-sm text-mi-marrom">
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
              className="group rounded-mi border border-mi-cinza bg-mi-branco p-8 shadow-suave transition-colors hover:border-mi-marrom"
            >
              <p className="font-corpo text-xs uppercase tracking-[0.25em] text-mi-marrom">
                {c.sub}
              </p>
              <h3 className="mt-2 font-titulo text-3xl text-mi-marrom-escuro">
                {c.titulo}
              </h3>
              <p className="mt-3 font-corpo text-sm text-mi-texto">{c.desc}</p>
              <span className="mt-5 inline-block font-corpo text-sm text-mi-marrom group-hover:text-mi-marrom-escuro">
                Ver mais ›
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* CTA FINAL */}
      <section className="mx-auto max-w-3xl px-5 py-20 text-center">
        <h2 className="text-balance font-titulo text-4xl text-mi-marrom-escuro sm:text-5xl">
          {content["home.cta.title"]}
        </h2>
        <p className="mx-auto mt-4 max-w-md font-corpo text-mi-texto">
          {content["home.cta.subtitle"]}
        </p>
        <Link
          href="/agendar"
          className="mt-8 inline-flex min-h-[52px] items-center justify-center rounded-mi bg-mi-marrom px-8 font-corpo text-base text-mi-branco shadow-suave transition-colors hover:bg-mi-marrom-escuro"
        >
          {content["home.cta.button"]}
        </Link>
      </section>
    </main>
  );
}
