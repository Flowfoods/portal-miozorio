"use client";

import { useFormState } from "react-dom";
import Link from "next/link";
import { joinClub, type ClubFormState } from "@/app/(site)/clube/actions";
import SubmitButton from "@/components/admin/SubmitButton";
import { PhoneField, Honeypot, FormError } from "./ClubFields";

/** Form de entrada no clube (landing /clube). Mobile-first (R19). */
export default function JoinForm() {
  const [state, action] = useFormState<ClubFormState, FormData>(
    joinClub,
    null,
  );
  return (
    <form action={action} className="space-y-4">
      <Honeypot />
      <label className="block">
        <span className="mb-1 block font-corpo text-sm text-mi-texto/80">
          Seu nome
        </span>
        <input name="name" required minLength={2} className="input-mi" />
      </label>
      <label className="block">
        <span className="mb-1 block font-corpo text-sm text-mi-texto/80">
          Seu WhatsApp
        </span>
        <PhoneField />
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block font-corpo text-sm text-mi-texto/80">
            E-mail (opcional)
          </span>
          <input name="email" type="email" className="input-mi" />
        </label>
        <label className="block">
          <span className="mb-1 block font-corpo text-sm text-mi-texto/80">
            Aniversário (opcional — pra te mimar)
          </span>
          <input name="birthDate" type="date" className="input-mi" />
        </label>
      </div>
      <label className="flex items-start gap-2 font-corpo text-sm text-mi-texto/80">
        <input type="checkbox" name="lgpd" required className="mt-1" />
        <span>
          Li e aceito a{" "}
          <Link href="/privacidade" className="underline underline-offset-4">
            política de privacidade
          </Link>
          .
        </span>
      </label>
      <FormError error={state?.error} />
      <SubmitButton
        pendingLabel="Entrando…"
        className="w-full rounded-mi bg-mi-marrom px-6 py-3.5 font-corpo text-mi-branco transition-colors hover:bg-mi-marrom-escuro sm:w-auto"
      >
        Quero participar
      </SubmitButton>
    </form>
  );
}
