"use client";

import { useFormState } from "react-dom";
import {
  trocarSenhaAdminAction,
  sairDeTodosAction,
  type ContaState,
} from "@/app/admin/conta-actions";
import SubmitButton from "@/components/admin/SubmitButton";
import PasswordField from "@/components/auth/PasswordField";
import { MIN_SENHA } from "@/lib/security";

/**
 * Conta do admin (Auth F4.3): trocar a senha (pedindo a atual) e sair de todos
 * os dispositivos. Ambas encerram a sessão atual (token_version), então após
 * trocar é preciso entrar de novo.
 */
export default function AdminContaForm() {
  const [state, action] = useFormState<ContaState, FormData>(
    trocarSenhaAdminAction,
    null,
  );
  const error = state && "error" in state ? state.error : null;
  const ok = state && "ok" in state ? state.ok : null;

  return (
    <div className="space-y-5">
      <form action={action} className="space-y-3">
        <PasswordField
          name="atual"
          placeholder="Senha atual"
          autoComplete="current-password"
          required
        />
        <PasswordField
          name="nova"
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
        {ok && <p className="text-sm text-emerald-700">{ok}</p>}
        <SubmitButton
          pendingLabel="Salvando…"
          className="rounded-mi bg-mi-marrom px-4 py-2.5 text-sm text-white transition-opacity disabled:opacity-60"
        >
          Trocar senha
        </SubmitButton>
      </form>

      <form action={sairDeTodosAction} className="border-t border-mi-cinza/60 pt-4">
        <p className="mb-2 text-xs text-mi-texto/80">
          Encerra a sessão em todos os aparelhos (inclusive aqui).
        </p>
        <button className="rounded-mi border border-mi-marrom px-4 py-2 text-sm text-mi-marrom-escuro transition-colors hover:bg-mi-marrom hover:text-white">
          Sair de todos os dispositivos
        </button>
      </form>
    </div>
  );
}
