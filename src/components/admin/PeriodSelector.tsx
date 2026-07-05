"use client";

import { useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  PERIOD_PRESETS,
  PRESET_LABEL,
  type PeriodPreset,
} from "@/lib/periods";
import { salvarPeriodoPref } from "@/app/admin/periodo-actions";

/**
 * Seletor de período GLOBAL do admin (F1.2) — um único componente para todos
 * os módulos. Estado vive na URL (compartilhável, sobrevive a refresh/voltar);
 * o último preset do módulo persiste em cookie httpOnly via server action.
 * Desktop: chips segmented. Mobile: <select> (alvos ≥44px). "Personalizado"
 * abre dois inputs de data nativos (pt-BR do navegador, mobile-friendly).
 */
export default function PeriodSelector({
  modulo,
  preset,
  deISO,
  ateISO,
  extenso,
  error,
}: {
  modulo: string;
  preset: PeriodPreset;
  deISO: string;
  ateISO: string;
  /** Intervalo por extenso, resolvido no servidor (pt-BR). */
  extenso: string;
  /** Mensagem gentil quando o personalizado veio inválido. */
  error?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const [, startTransition] = useTransition();

  const [custom, setCustom] = useState(preset === "personalizado");
  const [de, setDe] = useState(deISO);
  const [ate, setAte] = useState(ateISO);

  /** Troca só as chaves de período, preservando o resto da URL (regime, vista…). */
  function apply(query: string) {
    const params = new URLSearchParams(search.toString());
    params.delete("periodo");
    params.delete("de");
    params.delete("ate");
    // O período define o recorte; a navegação fina por dia (?data=) reinicia.
    params.delete("data");
    new URLSearchParams(query).forEach((v, k) => params.set(k, v));
    router.push(`${pathname}?${params.toString()}`);
    startTransition(() => {
      void salvarPeriodoPref(modulo, query); // fire-and-forget
    });
  }

  function pickPreset(p: PeriodPreset) {
    if (p === "personalizado") {
      setCustom(true);
      return;
    }
    setCustom(false);
    apply(`periodo=${p}`);
  }

  const deOk = /^\d{4}-\d{2}-\d{2}$/.test(de);
  const ateOk = /^\d{4}-\d{2}-\d{2}$/.test(ate);
  const customValido = deOk && ateOk && de <= ate;

  return (
    <div className="mb-6">
      {/* Mobile: select. Desktop (sm+): chips. */}
      <div className="sm:hidden">
        <label className="block">
          <span className="mb-1 block font-corpo text-xs text-mi-texto/60">
            Período
          </span>
          <select
            value={custom ? "personalizado" : preset}
            onChange={(e) => pickPreset(e.target.value as PeriodPreset)}
            className="input-mi min-h-[44px]"
          >
            {PERIOD_PRESETS.map((p) => (
              <option key={p} value={p}>
                {PRESET_LABEL[p]}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="hidden flex-wrap gap-1.5 sm:flex" role="group" aria-label="Período">
        {PERIOD_PRESETS.map((p) => {
          const ativo = custom ? p === "personalizado" : p === preset;
          return (
            <button
              key={p}
              type="button"
              onClick={() => pickPreset(p)}
              aria-pressed={ativo}
              className={`min-h-[44px] rounded-mi px-4 font-corpo text-sm transition-colors ${
                ativo
                  ? "bg-mi-marrom text-mi-branco"
                  : "bg-mi-superficie-elevada text-mi-texto shadow-suave hover:bg-mi-bege/60"
              }`}
            >
              {PRESET_LABEL[p]}
            </button>
          );
        })}
      </div>

      {/* Personalizado: range com inputs nativos (pt-BR, mobile-first). */}
      {custom && (
        <div className="mt-3 flex flex-wrap items-end gap-2">
          <label className="block">
            <span className="mb-1 block font-corpo text-xs text-mi-texto/60">De</span>
            <input
              type="date"
              value={de}
              max={ate || undefined}
              onChange={(e) => setDe(e.target.value)}
              className="input-mi min-h-[44px] !w-auto"
            />
          </label>
          <label className="block">
            <span className="mb-1 block font-corpo text-xs text-mi-texto/60">Até</span>
            <input
              type="date"
              value={ate}
              min={de || undefined}
              onChange={(e) => setAte(e.target.value)}
              className="input-mi min-h-[44px] !w-auto"
            />
          </label>
          <button
            type="button"
            disabled={!customValido}
            onClick={() => apply(`de=${de}&ate=${ate}`)}
            className="min-h-[44px] rounded-mi bg-mi-marrom px-5 font-corpo text-sm text-mi-branco transition-colors hover:bg-mi-marrom-escuro disabled:opacity-50"
          >
            Aplicar
          </button>
        </div>
      )}

      <p className="mt-2 font-corpo text-sm text-mi-texto/70 first-letter:uppercase">
        {extenso}
      </p>
      {error && (
        <p className="mt-1 rounded-mi bg-mi-bege/70 px-3 py-1.5 font-corpo text-xs text-mi-marrom-escuro">
          {error}
        </p>
      )}
    </div>
  );
}
