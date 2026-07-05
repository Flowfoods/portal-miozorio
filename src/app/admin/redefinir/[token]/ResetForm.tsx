"use client";

import { useFormState } from "react-dom";
import { completePasswordReset, type ResetState } from "../../reset-actions";
import SubmitButton from "@/components/admin/SubmitButton";
import PasswordField from "@/components/auth/PasswordField";
import { MIN_SENHA } from "@/lib/security";

/** Form de nova senha (M13.4). Recebe o token cru via prop (hidden field). */
export default function ResetForm({ token }: { token: string }) {
  const [state, action] = useFormState<ResetState, FormData>(
    completePasswordReset,
    null,
  );
  const error = state && "error" in state ? state.error : null;

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="token" value={token} />
      <PasswordField
        name="password"
        placeholder={`Nova senha (mín. ${MIN_SENHA})`}
        minLength={MIN_SENHA}
        autoComplete="new-password"
        showStrength
        required
      />
      <PasswordField
        name="confirm"
        placeholder="Repita a nova senha"
        minLength={MIN_SENHA}
        autoComplete="new-password"
        required
      />
      {error && <p className="text-sm text-red-700">{error}</p>}
      <SubmitButton
        pendingLabel="Salvando…"
        className="w-full rounded-mi bg-mi-marrom px-4 py-3 text-white transition-opacity disabled:opacity-60"
      >
        Salvar nova senha
      </SubmitButton>
    </form>
  );
}
