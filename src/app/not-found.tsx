import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Página não encontrada · Mi Ozorio",
  robots: { index: false, follow: false },
};

const WA =
  "https://wa.me/5521970225231?text=Oi%20Mi!%20Vim%20pelo%20site%20e%20preciso%20de%20ajuda";

/**
 * 404 da marca (auto-contido — o layout raiz não tem Header/Footer). Nenhum
 * beco sem saída: sempre oferece voltar ao início ou falar no WhatsApp.
 */
export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-[70vh] max-w-lg flex-col items-center justify-center px-5 py-16 text-center">
      <p className="font-corpo text-xs uppercase tracking-[0.3em] text-mi-marrom-escuro">
        Mi Ozorio · Beauty Artist
      </p>
      <h1 className="mt-3 font-titulo text-4xl text-mi-marrom-escuro">
        Não encontramos esta página
      </h1>
      <p className="mt-4 font-corpo text-mi-texto/80">
        O endereço pode ter mudado. Vamos te levar de volta — ou fale com a Mi
        direto no WhatsApp.
      </p>
      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <Link
          href="/"
          className="inline-flex min-h-[48px] items-center justify-center rounded-mi bg-mi-marrom-escuro px-8 font-corpo text-mi-branco transition-colors hover:bg-mi-marrom"
        >
          Voltar ao início
        </Link>
        <a
          href={WA}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-[48px] items-center justify-center rounded-mi border border-mi-marrom px-8 font-corpo text-mi-marrom transition-colors hover:bg-mi-branco"
        >
          Falar no WhatsApp
        </a>
      </div>
    </main>
  );
}
