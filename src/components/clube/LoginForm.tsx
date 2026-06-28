"use client";

import { useFormState } from "react-dom";
import { entrarAction, type ClienteFormState } from "@/app/(site)/clube/conta/actions";
import SubmitButton from "@/components/admin/SubmitButton";
import { PhoneField, FormError } from "./ClubFields";

/** Login do portal do cliente: telefone + senha. 1º acesso: senha = telefone. */
export default function LoginForm() {
  const [state, action] = useFormState<ClienteFormState, FormData>(
    entrarAction,
    null,
  );
  return (
    <form action={action} className="space-y-4">
      <label className="block">
        <span className="mb-1 block font-corpo text-sm text-mi-texto/70">
          Seu WhatsApp
        </span>
        <PhoneField />
      </label>
      <label className="block">
        <span className="mb-1 block font-corpo text-sm text-mi-texto/70">
          Senha
        </span>
        <input
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className="input-mi"
        />
        <span className="mt-1 block font-corpo text-xs text-mi-texto/55">
          No primeiro acesso, sua senha é o seu próprio telefone (só os números).
        </span>
      </label>
      <FormError error={state?.error} />
      <SubmitButton
        pendingLabel="Entrando…"
        className="w-full rounded-mi bg-mi-marrom px-6 py-3.5 font-corpo text-mi-branco transition-colors hover:bg-mi-marrom-escuro"
      >
        Entrar
      </SubmitButton>
    </form>
  );
}
