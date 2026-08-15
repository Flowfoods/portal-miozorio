import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo";
import { getPublishedMedia } from "@/lib/media";
import GaleriaLightbox from "@/components/site/GaleriaLightbox";
import Botao from "@/components/ui/Botao";

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
        <p className="font-corpo text-mi-texto/80">
          Em breve, os trabalhos da Mi por aqui.
        </p>
      ) : (
        <GaleriaLightbox
          fotos={fotos.map((f) => ({ id: f.id, url: f.url, alt: f.alt }))}
        />
      )}

      <div className="mt-12 text-center">
        <Botao href="/agendar">Quero agendar meu horário</Botao>
      </div>
    </main>
  );
}
