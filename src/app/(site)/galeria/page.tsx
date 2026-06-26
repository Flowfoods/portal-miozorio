import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { pageMeta } from "@/lib/seo";
import { getPublishedMedia } from "@/lib/media";

export const dynamic = "force-dynamic";

export const metadata: Metadata = pageMeta({
  path: "/galeria",
  title: "Galeria · trabalhos da Mi Ozorio",
  description:
    "Portfólio da Milene Ozorio: maquiagens e penteados para noivas, debutantes, madrinhas e o dia a dia.",
  ogTitle: "Galeria",
});

export default async function GaleriaPage() {
  const fotos = await getPublishedMedia("portfolio");

  return (
    <main className="mx-auto max-w-5xl px-5 py-16">
      <header className="mb-10">
        <h1 className="font-titulo text-5xl text-mi-marrom-escuro">Galeria</h1>
        <p className="mt-4 max-w-2xl font-corpo text-lg text-mi-texto/80">
          Cada rosto, uma história. Alguns dos trabalhos da Mi.
        </p>
      </header>

      {fotos.length === 0 ? (
        <p className="font-corpo text-mi-texto/70">
          Em breve, os trabalhos da Mi por aqui.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {fotos.map((foto) => (
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
          ))}
        </div>
      )}

      <div className="mt-12 text-center">
        <Link
          href="/agendar"
          className="inline-flex min-h-[52px] items-center justify-center rounded-mi bg-mi-marrom px-7 font-corpo text-mi-branco shadow-suave transition-colors hover:bg-mi-marrom-escuro"
        >
          Quero agendar meu horário
        </Link>
      </div>
    </main>
  );
}
