"use client";

import { useFormState } from "react-dom";
import { adminGerarCodigoRecuperacao } from "@/app/admin/actions";
import type { CodigoRecuperacaoState } from "@/lib/recuperacao-tipos";
import SubmitButton from "./SubmitButton";

/**
 * B2 — "Gerar código de recuperação" na ficha da cliente. Serve para quando a
 * cliente liga direto para a Mi em vez de pedir pelo site: o código aparece
 * aqui e o botão abre a conversa dela já com a mensagem pronta.
 *
 * É o mesmo módulo e a mesma tabela do fluxo público — não existe um segundo
 * caminho de recuperação escondido no painel.
 */
export default function CodigoRecuperacao({
  customerId,
}: {
  customerId: string;
}) {
  const [state, action] = useFormState<CodigoRecuperacaoState, FormData>(
    adminGerarCodigoRecuperacao,
    null,
  );
  const codigo = state && "ok" in state ? state.ok : null;
  const erro = state && "error" in state ? state.error : null;

  return (
    <div className="rounded-mi border border-mi-cinza p-3">
      <p className="font-medium text-mi-marrom-escuro">Acesso da cliente</p>
      <p className="mt-0.5 text-xs text-mi-texto/80">
        Esqueceu a senha e te chamou direto? Gere o código aqui e mande pelo
        WhatsApp dela.
      </p>

      {codigo && (
        <div className="mt-3 rounded-mi bg-mi-bege/60 p-3">
          <p className="text-center font-titulo text-3xl tracking-[0.3em] text-mi-marrom-escuro">
            {codigo.codigo}
          </p>
          <p className="mt-1 text-center text-xs text-mi-texto/80">
            Para {codigo.nome} · {codigo.telefoneVisivel} · vale até{" "}
            {codigo.ate}
          </p>
          <a
            href={codigo.link}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 block rounded-mi bg-mi-marrom-escuro px-4 py-2.5 text-center text-sm text-white"
          >
            Enviar pelo WhatsApp dela
          </a>
        </div>
      )}

      {erro && <p className="mt-2 text-sm text-mi-erro-tinta">{erro}</p>}

      <form action={action} className="mt-3">
        <input type="hidden" name="customerId" value={customerId} />
        <SubmitButton
          pendingLabel="Gerando…"
          className="w-full rounded-mi border border-mi-cinza px-4 py-2 text-sm"
        >
          {codigo ? "Gerar outro código" : "Gerar código de recuperação"}
        </SubmitButton>
      </form>
    </div>
  );
}
