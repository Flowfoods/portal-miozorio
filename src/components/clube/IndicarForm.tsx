"use client";

import { useFormState } from "react-dom";
import Link from "next/link";
import { submitReferral, type ClubFormState } from "@/app/(site)/clube/actions";
import SubmitButton from "@/components/admin/SubmitButton";
import { PhoneField, Honeypot, FormError } from "./ClubFields";

/**
 * Form da indicada (/indicar/[codigo]) — ocasião e referência. Mobile-first
 * (R19): a amiga chega pelo WhatsApp.
 *
 * NÃO pergunta alergia (14/09/2026). Alergia é dado de saúde e, pela LGPD,
 * sensível (art. 5º, II): coletar por consentimento exige um aceite
 * "específico e destacado" (art. 11, I), e aqui só existe o checkbox genérico
 * da política. O portal já tem a trava certa para isso
 * (`lib/consentimento-saude.ts`), mas ela vive no agendamento — e carimbar o
 * consentimento aqui seria pior: este formulário é público e não prova posse
 * do telefone.
 *
 * Nada se perde: a anamnese acontece quando ela mesma marca o horário, onde o
 * consentimento específico já é exigido de quem de fato escreve uma alergia.
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
      <label className="block">
        <span className="mb-1 block font-corpo text-sm text-mi-texto/80">
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
        <span className="mb-1 block font-corpo text-sm text-mi-texto/80">
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
        className="w-full rounded-mi bg-mi-marrom-escuro px-6 py-3.5 font-corpo text-mi-branco transition-colors hover:bg-mi-marrom"
      >
        Quero me cuidar com a Mi
      </SubmitButton>
    </form>
  );
}
