"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

/**
 * A6 — confirmação visível do que acabou de acontecer.
 *
 * O painel só falava com a Mi quando dava ERRO (o throw da server action cai no
 * error.tsx). No caminho feliz a tela apenas piscava: ela clicava em "Criar
 * serviço", nada dizia "pronto", e ela clicava de novo — foi assim que "Buço"
 * virou três registros.
 *
 * Lê a mensagem de `?ok=`, mostra e limpa a URL (para não reaparecer no reload
 * nem ao voltar). `role="status"` + `aria-live="polite"` para leitor de tela.
 */
export default function Toast() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const msg = params.get("ok");
  const [visivel, setVisivel] = useState(false);

  useEffect(() => {
    if (!msg) return;
    setVisivel(true);
    // Limpa o ?ok= já, sem esperar o fim da animação: se a Mi recarregar a
    // página o toast não pode voltar dizendo que ela criou algo de novo.
    router.replace(pathname, { scroll: false });
    const t = setTimeout(() => setVisivel(false), 5000);
    return () => clearTimeout(t);
  }, [msg, router, pathname]);

  if (!msg || !visivel) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="mi-fade-in fixed inset-x-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-50 mx-auto max-w-sm rounded-mi bg-mi-marrom-escuro px-4 py-3 text-center font-corpo text-sm text-mi-branco shadow-suave sm:left-auto sm:right-6 sm:mx-0"
    >
      {msg}
      <button
        type="button"
        onClick={() => setVisivel(false)}
        aria-label="Fechar aviso"
        className="ml-3 align-middle text-mi-branco/80 hover:text-mi-branco"
      >
        ✕
      </button>
    </div>
  );
}
