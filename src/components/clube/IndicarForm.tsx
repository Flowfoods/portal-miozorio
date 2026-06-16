"use client";

import { useFormState } from "react-dom";
import Link from "next/link";
import { submitReferral, type ClubFormState } from "@/app/clube/actions";
import SubmitButton from "@/components/admin/SubmitButton";
import { PhoneField, Honeypot, FormError } from "./ClubFields";

/**
 * Form da indicada (/indicar/[codigo]) — anamnese leve da Mi: ocasião,
 * alergia, referência. Mobile-first (R19): a amiga chega pelo WhatsApp.
 */
export default function IndicarForm({
  codigo,
  ocasioes,
}: {
  codigo: string;
  ocasioes: readonly string[];
}) {
  const [state, action] = useFormState<ClubFormState, FormData>(
    submitReferral,
    null,
  );
  return (
    <form action={action} className="space-y-4">
      <Honeypot />
      <input type="hidden" name="codigo" value={codigo} />
      <label className="block">
        <span className="mb-1 block font-corpo text-sm text-mi-texto/70">
          Seu nome
        </span>
        <input name="name" required minLength={2} className="input-mi" />
      </label>
      <label className="block">
        <span className="mb-1 block font-corpo text-sm text-mi-texto/70">
          Seu WhatsApp
        </span>
        <PhoneField />
      </label>
      <label className="block">
        <span className="mb-1 block font-corpo text-sm text-mi-texto/70">
          Qual é a ocasião?
        </span>
        <select name="ocasiao" required className="input-mi" defaultValue="">
          <option value="" disabled>
            Escolha…
          </option>
          {ocasioes.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className="mb-1 block font-corpo text-sm text-mi-texto/70">
          Tem alguma alergia? (opcional)
        </span>
        <input
          name="alergia"
          placeholder="Ex.: látex, fragrância…"
          className="input-mi"
        />
      </label>
      <label className="block">
        <span className="mb-1 block font-corpo text-sm text-mi-texto/70">
          Já tem uma referência do que quer? (opcional)
        </span>
        <input
          name="referencia"
          placeholder="Ex.: maquiagem iluminada, penteado preso…"
          className="input-mi"
        />
      </label>
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
        pendingLabel="Enviando…"
        className="w-full rounded-mi bg-mi-marrom px-6 py-3.5 font-corpo text-mi-branco transition-colors hover:bg-mi-marrom-escuro"
      >
        Quero me cuidar com a Mi 💛
      </SubmitButton>
    </form>
  );
}
