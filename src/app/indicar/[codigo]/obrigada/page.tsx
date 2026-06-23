import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Recebido! · Mi Ozorio",
  robots: { index: false, follow: false },
};

const WA =
  "https://wa.me/5521970225231?text=Oi%20Mi!%20Fui%20indicada%20por%20uma%20amiga%20e%20quero%20me%20cuidar%20com%20voc%C3%AA";

/** Confirmação pós-indicação. Sem dado pessoal na URL nem na tela. */
export default function ObrigadaPage() {
  return (
    <main className="mx-auto max-w-lg px-5 pb-24 pt-20 text-center">
      <h1 className="text-3xl leading-tight sm:text-4xl">
        Recebi seu pedido!
      </h1>
      <p className="mt-4 font-corpo text-mi-texto/80">
        A Mi vai falar com você no WhatsApp para combinar tudo com carinho. Se
        preferir, adiante a conversa ou já garanta seu horário:
      </p>
      <div className="mt-8 flex flex-col gap-3">
        <a
          href={WA}
          className="inline-flex min-h-[48px] items-center justify-center rounded-mi bg-mi-marrom px-8 font-corpo text-mi-branco transition-colors hover:bg-mi-marrom-escuro"
        >
          Chamar a Mi no WhatsApp
        </a>
        <Link
          href="/agendar"
          className="inline-flex min-h-[48px] items-center justify-center rounded-mi border border-mi-marrom px-8 font-corpo text-mi-marrom transition-colors hover:bg-mi-branco"
        >
          Ver horários disponíveis
        </Link>
      </div>
    </main>
  );
}
