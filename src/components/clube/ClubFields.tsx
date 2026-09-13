"use client";

import { useEffect, useRef, useState } from "react";
import { maskPhoneBR } from "@/lib/format";

/**
 * Campo de WhatsApp com máscara (21) 99999-9999 — compartilhado nos forms do clube.
 *
 * B1 — o campo é controlado (precisa ser, por causa da máscara), e isso brigava
 * com o autofill: Safari/Chrome preenchem o input sem que o React saiba, o
 * estado continua vazio e o form envia telefone em branco — "senha certa, login
 * não entra". O `useEffect` de montagem lê o que já está no DOM (autofill e o
 * que a pessoa digitou antes da hidratação) e o `onBlur` reaplica a máscara
 * sobre o valor real do input. `autoComplete="tel"` ajuda o navegador a acertar
 * o campo em vez de chutar.
 */
export function PhoneField({
  name = "phone",
  defaultValue = "",
}: {
  name?: string;
  defaultValue?: string;
}) {
  const [value, setValue] = useState(() => maskPhoneBR(defaultValue));
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const doDom = ref.current?.value ?? "";
    if (doDom && doDom !== value) setValue(maskPhoneBR(doDom));
    // Só na montagem: a partir daí o onChange manda.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <input
      ref={ref}
      name={name}
      value={value}
      onChange={(e) => setValue(maskPhoneBR(e.target.value))}
      onBlur={(e) => setValue(maskPhoneBR(e.target.value))}
      type="tel"
      inputMode="tel"
      autoComplete="tel"
      autoCapitalize="off"
      autoCorrect="off"
      spellCheck={false}
      placeholder="(21) 99999-9999"
      required
      className="input-mi"
    />
  );
}

/** Honeypot anti-bot: invisível para gente, irresistível para script. */
export function Honeypot() {
  return (
    <input
      type="text"
      name="site"
      tabIndex={-1}
      autoComplete="off"
      aria-hidden="true"
      className="absolute left-[-9999px] h-0 w-0 opacity-0"
    />
  );
}

/** Erro inline dos forms públicos (não joga para error.tsx). */
export function FormError({
  error,
  children,
}: {
  error: string | undefined;
  /** Ação sugerida (link de cadastro, pedir código…) dentro da mesma caixa. */
  children?: React.ReactNode;
}) {
  if (!error) return null;
  return (
    <div
      role="alert"
      className="rounded-mi bg-mi-erro/10 px-4 py-3 text-sm text-mi-erro-tinta ring-1 ring-mi-erro/40"
    >
      <p>{error}</p>
      {children}
    </div>
  );
}
