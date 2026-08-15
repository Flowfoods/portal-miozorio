"use client";

import { useFormState } from "react-dom";
import { adminCriarClienteManual } from "@/app/admin/actions";
import SubmitButton from "./SubmitButton";
import { PhoneField, FormError } from "@/components/clube/ClubFields";

/**
 * Cadastro manual de cliente (aba Clientes). Chama o mesmo `criarCliente()` do
 * fluxo normal → paridade de benefícios. Telefone com máscara; validação E.164
 * no servidor. Já existe → a action abre a ficha existente (sem duplicar).
 */
export default function NovaClienteForm() {
  const [state, action] = useFormState<{ error: string } | null, FormData>(
    adminCriarClienteManual,
    null,
  );
  return (
    <details className="mb-6 rounded-mi bg-mi-superficie-elevada p-4 shadow-suave">
      <summary className="cursor-pointer font-corpo text-sm text-mi-marrom-escuro">
        ＋ Cadastrar cliente
      </summary>
      <form action={action} className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-xs text-mi-texto/80">Nome</span>
          <input name="name" required minLength={2} className="input-mi" />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs text-mi-texto/80">WhatsApp</span>
          <PhoneField />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs text-mi-texto/80">E-mail (opcional)</span>
          <input name="email" type="email" className="input-mi" />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs text-mi-texto/80">
            Nascimento (opcional)
          </span>
          <input type="date" name="birthDate" className="input-mi" />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs text-mi-texto/80">
            Origem do contato (opcional)
          </span>
          <input
            name="origem"
            placeholder="indicação, Instagram, presencial…"
            className="input-mi"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs text-mi-texto/80">Alergias (opcional)</span>
          <input name="allergies" className="input-mi" />
        </label>
        <label className="block sm:col-span-2">
          <span className="mb-1 block text-xs text-mi-texto/80">Anotações (opcional)</span>
          <input name="notes" className="input-mi" />
        </label>
        <label className="flex items-start gap-2 text-sm sm:col-span-2">
          <input type="checkbox" name="whatsappOptIn" className="mt-1" />
          <span className="text-mi-texto/80">
            A cliente autoriza receber mensagens no WhatsApp (lembretes, clube).
          </span>
        </label>
        <FormError error={state?.error} />
        <div className="sm:col-span-2">
          <SubmitButton
            pendingLabel="Cadastrando…"
            className="rounded-mi bg-mi-marrom px-5 py-2.5 text-sm text-white"
          >
            Cadastrar e abrir ficha
          </SubmitButton>
        </div>
      </form>
    </details>
  );
}
