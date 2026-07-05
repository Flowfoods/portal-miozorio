"use client";

import { forwardRef, useState, type InputHTMLAttributes } from "react";

/**
 * Campo de senha compartilhado pelos DOIS portais (admin e cliente) — Auth F1.1.
 * Entrega: ver/ocultar senha (alvo ≥44px, aria correto), aviso de Caps Lock e,
 * opcional, medidor de força. Não quebra autofill: mantém `name`/`autoComplete`
 * do input real; o botão do olho é `type="button"` (nunca dá submit).
 */

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & {
  /** Mostra o medidor de força abaixo do campo (telas de nova senha). */
  showStrength?: boolean;
};

interface Forca {
  score: 0 | 1 | 2 | 3 | 4;
  label: string;
  cor: string;
}

// Senhas óbvias demais — bloqueia o pior caso sem depender de rede (HIBP fica p/ depois).
const FRACAS = new Set([
  "12345678",
  "123456789",
  "12345678910",
  "senha123",
  "password",
  "qwertyui",
]);

function medirForca(v: string): Forca {
  if (!v) return { score: 0, label: "", cor: "" };
  if (FRACAS.has(v.toLowerCase())) {
    return { score: 0, label: "muito fácil de adivinhar", cor: "bg-red-500" };
  }
  let n = 0;
  if (v.length >= 8) n++;
  if (v.length >= 12) n++;
  if (/[a-z]/.test(v) && /[A-Z]/.test(v)) n++;
  if (/\d/.test(v)) n++;
  if (/[^A-Za-z0-9]/.test(v)) n++;
  const score = Math.min(4, n) as Forca["score"];
  const escala: Record<Forca["score"], Forca> = {
    0: { score: 0, label: "muito fraca", cor: "bg-red-500" },
    1: { score: 1, label: "fraca", cor: "bg-red-400" },
    2: { score: 2, label: "razoável", cor: "bg-amber-400" },
    3: { score: 3, label: "boa", cor: "bg-emerald-400" },
    4: { score: 4, label: "forte", cor: "bg-emerald-500" },
  };
  return escala[score];
}

const PasswordField = forwardRef<HTMLInputElement, Props>(function PasswordField(
  { className, showStrength, onChange, onKeyUp, onKeyDown, onBlur, ...rest },
  ref,
) {
  const [show, setShow] = useState(false);
  const [caps, setCaps] = useState(false);
  const [valor, setValor] = useState(
    typeof rest.defaultValue === "string" ? rest.defaultValue : "",
  );

  const forca = showStrength ? medirForca(valor) : null;

  return (
    <div>
      <div className="relative">
        <input
          {...rest}
          ref={ref}
          type={show ? "text" : "password"}
          className={`${className ?? "input-mi"} pr-12`}
          onChange={(e) => {
            setValor(e.target.value);
            onChange?.(e);
          }}
          onKeyUp={(e) => {
            setCaps(e.getModifierState?.("CapsLock") ?? false);
            onKeyUp?.(e);
          }}
          onKeyDown={(e) => {
            setCaps(e.getModifierState?.("CapsLock") ?? false);
            onKeyDown?.(e);
          }}
          onBlur={(e) => {
            setCaps(false);
            onBlur?.(e);
          }}
        />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          aria-label={show ? "Ocultar senha" : "Mostrar senha"}
          aria-pressed={show}
          className="absolute right-0 top-0 flex h-full w-12 items-center justify-center text-mi-marrom/70 transition-colors hover:text-mi-marrom"
        >
          {show ? (
            // olho cortado (ocultar)
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 10 8 10 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
              <path d="M6.61 6.61A18.5 18.5 0 0 0 2 12s3 8 10 8a9.12 9.12 0 0 0 5.39-1.61" />
              <line x1="2" y1="2" x2="22" y2="22" />
            </svg>
          ) : (
            // olho aberto (mostrar)
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M2 12s3-8 10-8 10 8 10 8-3 8-10 8-10-8-10-8z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          )}
        </button>
      </div>

      {caps && (
        <p role="status" className="mt-1 font-corpo text-xs text-amber-700">
          ⚠️ Caps Lock ativado
        </p>
      )}

      {forca && valor && (
        <div className="mt-2" aria-live="polite">
          <div className="flex gap-1" aria-hidden="true">
            {[0, 1, 2, 3].map((i) => (
              <span
                key={i}
                className={`h-1 flex-1 rounded-full transition-colors ${
                  i < Math.max(1, forca.score) ? forca.cor : "bg-mi-cinza"
                }`}
              />
            ))}
          </div>
          <p className="mt-1 font-corpo text-xs text-mi-texto/60">
            Força da senha: {forca.label}
          </p>
        </div>
      )}
    </div>
  );
});

export default PasswordField;
