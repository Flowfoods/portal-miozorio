import type { Metadata } from "next";
import Image from "next/image";
import { pageMeta } from "@/lib/seo";
import { getPublishedMedia } from "@/lib/media";
import { getSiteContent, parseLinhas } from "@/lib/content";
import MonogramPlaceholder from "@/components/site/MonogramPlaceholder";

// ISR: retrato vem de media_assets; o painel revalida na hora ao publicar.
export const revalidate = 3600;

export const metadata: Metadata = pageMeta({
  path: "/sobre",
  title: "Sobre a Mi · Milene Ozorio Beauty Artist",
  description:
    "Conheça a Milene Ozorio: 12 anos de experiência em maquiagem e penteado, estúdio em Santíssimo, RJ. Formações em HD, colorimetria, pele negra e visagismo.",
  ogTitle: "Sobre a Mi",
});

const MAPA =
  "https://www.google.com/maps?q=Rua+Ipom%C3%A9ia,+5,+Sant%C3%ADssimo,+Rio+de+Janeiro&output=embed";

export default async function SobrePage() {
  const [retrato] = await getPublishedMedia("sobre", 1);
  const content = await getSiteContent();
  const formacoes = parseLinhas(content["sobre.formacoes.lista"] ?? "");
  return (
    <main>
      <section className="mx-auto grid max-w-5xl items-center gap-10 px-5 py-16 sm:py-24 md:grid-cols-2">
        <div>
          <p className="font-corpo text-xs uppercase tracking-[0.3em] text-mi-marrom">
            Sobre a Mi
          </p>
          <h1 className="mt-5 font-titulo text-5xl leading-tight text-mi-marrom-escuro">
            {content["sobre.hero.title"]}
          </h1>
          <p className="mt-5 font-corpo text-lg font-light text-mi-texto">
            {content["sobre.hero.p1"]}
          </p>
          <p className="mt-4 font-corpo text-mi-texto">
            {content["sobre.hero.p2"]}
          </p>
        </div>
        <div className="relative aspect-[4/5] w-full overflow-hidden rounded-mi bg-mi-bege shadow-suave">
          {retrato ? (
            <Image
              src={retrato.url}
              alt={retrato.alt}
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

      {/* Formações */}
      <section className="bg-mi-branco/50 py-16">
        <div className="mx-auto max-w-5xl px-5">
          <h2 className="text-center font-titulo text-3xl text-mi-marrom-escuro">
            {content["sobre.formacoes.title"]}
          </h2>
          <ul className="mx-auto mt-8 flex max-w-3xl flex-wrap justify-center gap-3">
            {formacoes.map((f) => (
              <li
                key={f}
                className="rounded-mi border border-mi-cinza bg-mi-branco px-4 py-2 font-corpo text-sm text-mi-texto"
              >
                {f}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Estúdio */}
      <section className="mx-auto max-w-5xl px-5 py-16">
        <div className="grid items-center gap-10 md:grid-cols-2">
          <div>
            <h2 className="font-titulo text-3xl text-mi-marrom-escuro">
              O estúdio
            </h2>
            <p className="mt-4 font-corpo text-mi-texto">
              {content["sobre.estudio.texto"]}
            </p>
            <p className="mt-4 font-corpo text-mi-marrom-escuro">
              {content["sobre.estudio.endereco"]}
            </p>
          </div>
          <div className="aspect-video w-full overflow-hidden rounded-mi border border-mi-cinza shadow-suave">
            <iframe
              src={MAPA}
              title="Mapa do estúdio Mi Ozorio"
              className="h-full w-full"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
          </div>
        </div>
      </section>
    </main>
  );
}
