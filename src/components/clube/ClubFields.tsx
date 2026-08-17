"use client";

import { useState } from "react";
import { maskPhoneBR } from "@/lib/format";

/** Campo de WhatsApp com máscara (21) 99999-9999 — compartilhado nos forms do clube. */
export function PhoneField({ name = "phone" }: { name?: string }) {
  const [value, setValue] = useState("");
  return (
    <input
      name={name}
      value={value}
      onChange={(e) => setValue(maskPhoneBR(e.target.value))}
      type="tel"
      inputMode="tel"
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
export function FormError({ error }: { error: string | undefined }) {
  if (!error) return null;
  return (
    <p className="rounded-mi bg-mi-erro/10 px-4 py-3 text-sm text-mi-erro-tinta ring-1 ring-mi-erro/40">
      {error}
    </p>
  );
}
