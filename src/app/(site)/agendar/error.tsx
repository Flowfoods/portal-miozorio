"use client";

import { useEffect } from "react";

/**
 * Rede de segurança do fluxo de agendamento: qualquer exceção inesperada cai
 * aqui (tela da marca + "tentar de novo"), nunca na tela branca do Next. O erro
 * real é logado no servidor com o `digest`; ao cliente, só mensagem tratada.
 * Conflito de horário NÃO chega aqui — é tratado inline no wizard/painel.
 */
export default function AgendarError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("agendar: erro inesperado", error.digest, error);
  }, [error]);

  const WA =
    "https://wa.me/5521970225231?text=Oi%20Mi!%20Tive%20um%20probleminha%20pra%20agendar%20pelo%20site";

  return (
    <main className="mx-auto flex min-h-[60vh] max-w-lg flex-col items-center justify-center px-5 py-16 text-center">
      <h1 className="font-titulo text-3xl text-mi-marrom-escuro">
        Algo não saiu como esperado
      </h1>
      <p className="mt-4 font-corpo text-mi-texto/80">
        Tive um probleminha aqui — não foi você. Tente de novo, ou fale comigo no
        WhatsApp que eu agendo pra você 💛
      </p>
      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <button
          type="button"
          onClick={reset}
          className="inline-flex min-h-[48px] items-center justify-center rounded-mi bg-mi-marrom-escuro px-8 font-corpo text-mi-branco transition-colors hover:bg-mi-marrom"
        >
          Tentar de novo
        </button>
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
