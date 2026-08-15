"use client";

/** Erros das server actions do painel (regra violada, formato inválido). */
export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto max-w-md rounded-mi bg-mi-branco p-8 text-center shadow-suave">
      <h2 className="mb-2 text-2xl">Ops, algo deu errado</h2>
      <p className="mb-6 text-sm text-mi-texto/80">
        {error.message || "Não foi possível concluir a ação."}
      </p>
      <button
        onClick={reset}
        className="rounded-mi bg-mi-marrom px-5 py-2.5 text-sm text-white"
      >
        Voltar
      </button>
    </div>
  );
}
