"use client";

import { useFormState } from "react-dom";
import Link from "next/link";
import { requestPasswordReset, type ResetState } from "../reset-actions";
import SubmitButton from "@/components/admin/SubmitButton";

/** Pedir link de redefinição de senha (M13.4). Público. */
export default function RecuperarPage() {
  const [state, action] = useFormState<ResetState, FormData>(
    requestPasswordReset,
    null,
  );
  const ok = state && "ok" in state ? state.ok : null;
  const error = state && "error" in state ? state.error : null;

  return (
    <div className="mx-auto max-w-sm">
      <h1 className="mb-2 text-3xl">Esqueci a senha</h1>
      <p className="mb-8 text-sm text-mi-texto/70">
        Informe o e-mail da sua conta do estúdio. Se houver uma conta, enviamos
        um link para criar uma nova senha.
      </p>
      {ok ? (
        <p className="rounded-mi bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          {ok}
        </p>
      ) : (
        <form action={action} className="space-y-4">
          {/* Honeypot anti-bot: humano não preenche campo escondido. */}
          <input
            type="text"
            name="site"
            tabIndex={-1}
            autoComplete="off"
            aria-hidden
            className="hidden"
          />
          <input
            className="input-mi"
            type="email"
            name="email"
            placeholder="E-mail"
            autoComplete="username"
            required
          />
          {error && <p className="text-sm text-red-700">{error}</p>}
          <SubmitButton
            pendingLabel="Enviando…"
            className="w-full rounded-mi bg-mi-marrom px-4 py-3 text-white transition-opacity disabled:opacity-60"
          >
            Enviar link
          </SubmitButton>
        </form>
      )}
      <p className="mt-6 text-center text-sm">
        <Link href="/admin/login" className="text-mi-marrom underline">
          Voltar ao login
        </Link>
      </p>
    </div>
  );
}
