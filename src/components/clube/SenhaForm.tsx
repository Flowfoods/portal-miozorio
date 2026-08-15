"use client";

import { useFormState } from "react-dom";
import Link from "next/link";
import {
  definirSenhaAction,
  type ClienteFormState,
} from "@/app/(site)/clube/conta/actions";
import SubmitButton from "@/components/admin/SubmitButton";
import PasswordField from "@/components/auth/PasswordField";
import { FormError } from "./ClubFields";

/**
 * Definição de nova senha do cliente. Na 1ª troca (provisória) o consentimento
 * LGPD é obrigatório; depois disso vira troca de rotina (sem consent).
 */
export default function SenhaForm({ provisoria }: { provisoria: boolean }) {
  const [state, action] = useFormState<ClienteFormState, FormData>(
    definirSenhaAction,
    null,
  );
  return (
    <form action={action} className="space-y-4">
      <label className="block">
        <span className="mb-1 block font-corpo text-sm text-mi-texto/80">
          Nova senha
        </span>
        <PasswordField
          name="password"
          required
          minLength={6}
          autoComplete="new-password"
          showStrength
        />
        <span className="mt-1 block font-corpo text-xs text-mi-texto/80">
          Pelo menos 6 caracteres, diferente do seu telefone.
        </span>
      </label>
      {provisoria && (
        <label className="flex items-start gap-2 font-corpo text-sm text-mi-texto/80">
          <input type="checkbox" name="consent" required className="mt-1" />
          <span>
            Li e aceito a{" "}
            <Link href="/privacidade" className="underline underline-offset-4">
              política de privacidade
            </Link>
            .
          </span>
        </label>
      )}
      <FormError error={state?.error} />
      <SubmitButton
        pendingLabel="Salvando…"
        className="w-full rounded-mi bg-mi-marrom px-6 py-3.5 font-corpo text-mi-branco transition-colors hover:bg-mi-marrom-escuro"
      >
        {provisoria ? "Definir senha e entrar" : "Salvar nova senha"}
      </SubmitButton>
    </form>
  );
}
