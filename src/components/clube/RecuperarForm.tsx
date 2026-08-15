"use client";

import { useEffect, useRef, useState } from "react";
import { useFormState } from "react-dom";
import {
  pedirCodigoAction,
  validarCodigoAction,
  trocarSenhaAction,
  type PedirState,
  type ValidarState,
  type SenhaState,
} from "@/app/(site)/clube/recuperar/actions";
import SubmitButton from "@/components/admin/SubmitButton";
import PasswordField from "@/components/auth/PasswordField";
import { PhoneField, FormError } from "./ClubFields";

type Step = "phone" | "code" | "senha";

/**
 * Recuperação de senha da cliente em 3 passos (F2.2): WhatsApp → código → nova
 * senha. Neutro no passo 1 (não revela se o número existe). Reenvio com
 * cooldown de 60s. Mobile-first — a cliente chega pelo celular.
 */
export default function RecuperarForm() {
  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("");

  const [pedir, pedirAction] = useFormState<PedirState, FormData>(
    pedirCodigoAction,
    null,
  );
  const [validar, validarAction] = useFormState<ValidarState, FormData>(
    validarCodigoAction,
    null,
  );
  const [senha, senhaAction] = useFormState<SenhaState, FormData>(
    trocarSenhaAction,
    null,
  );

  // Passo 1 concluído (neutro) → guarda o telefone e vai pro código.
  useEffect(() => {
    if (pedir && "ok" in pedir && pedir.ok) {
      setPhone(pedir.phone);
      setStep("code");
    }
  }, [pedir]);

  // Código validado → tela de nova senha.
  useEffect(() => {
    if (validar && "ok" in validar && validar.ok) setStep("senha");
  }, [validar]);

  // Cooldown de reenvio (60s).
  const [cooldown, setCooldown] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    if (step === "code") setCooldown(60);
  }, [step, pedir]);
  useEffect(() => {
    if (cooldown <= 0) return;
    timer.current = setInterval(() => setCooldown((c) => c - 1), 1000);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [cooldown]);

  if (step === "phone") {
    return (
      <form action={pedirAction} className="space-y-4">
        <label className="block">
          <span className="mb-1 block font-corpo text-sm text-mi-texto/80">
            Seu WhatsApp
          </span>
          <PhoneField />
        </label>
        <FormError error={pedir && "error" in pedir ? pedir.error : undefined} />
        <SubmitButton
          pendingLabel="Enviando…"
          className="w-full rounded-mi bg-mi-marrom px-6 py-3.5 font-corpo text-mi-branco transition-colors hover:bg-mi-marrom-escuro"
        >
          Enviar código
        </SubmitButton>
      </form>
    );
  }

  if (step === "code") {
    return (
      <div className="space-y-4">
        <p className="font-corpo text-sm text-mi-texto/80">
          Se este número tiver conta no Clube, enviamos um código de 6 dígitos
          por WhatsApp. Digite ele aqui:
        </p>
        <form action={validarAction} className="space-y-4">
          <input type="hidden" name="phone" value={phone} />
          <input
            name="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="\d{6}"
            maxLength={6}
            required
            placeholder="000000"
            className="input-mi text-center text-2xl tracking-[0.5em]"
          />
          <FormError
            error={validar && "error" in validar ? validar.error : undefined}
          />
          <SubmitButton
            pendingLabel="Conferindo…"
            className="w-full rounded-mi bg-mi-marrom px-6 py-3.5 font-corpo text-mi-branco transition-colors hover:bg-mi-marrom-escuro"
          >
            Confirmar código
          </SubmitButton>
        </form>
        <form action={pedirAction}>
          <input type="hidden" name="phone" value={phone} />
          <button
            type="submit"
            disabled={cooldown > 0}
            className="w-full font-corpo text-sm text-mi-marrom-escuro underline underline-offset-4 disabled:text-mi-texto/40 disabled:no-underline"
          >
            {cooldown > 0 ? `Reenviar em ${cooldown}s` : "Reenviar código"}
          </button>
        </form>
      </div>
    );
  }

  // step === "senha"
  return (
    <form action={senhaAction} className="space-y-4">
      <p className="font-corpo text-sm text-mi-texto/80">
        Código confirmado 💛 Agora crie sua nova senha:
      </p>
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
      <FormError error={senha?.error} />
      <SubmitButton
        pendingLabel="Salvando…"
        className="w-full rounded-mi bg-mi-marrom px-6 py-3.5 font-corpo text-mi-branco transition-colors hover:bg-mi-marrom-escuro"
      >
        Salvar e entrar
      </SubmitButton>
    </form>
  );
}
