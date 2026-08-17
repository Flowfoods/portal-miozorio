"use client";

import { useId, useState } from "react";
import { DESTAQUE, BARRA, GRID, EIXO_TEXTO, fmtBRL, fmtInt } from "@/lib/charts/theme";

export type BarraDado = { label: string; valor: number; destaque?: boolean };

/**
 * Barras verticais (atendimentos por dia da semana etc.). Topo arredondado
 * 6px, eixo Y sempre a partir do zero, grade só horizontal. O pico é
 * destacado em marrom-700 e o resto fica em marrom-300 — é a hierarquia que
 * guia o olho. Entrada 400ms ease-out uma vez só; prefers-reduced-motion ok.
 *
 * Tooltip (lições da revisão adversarial de 17/08):
 * - vive no TOPO do container (não acima da barra): o wrapper com
 *   overflow-x-auto vira contexto de clip e decapitava o tooltip do pico;
 * - no toque, hover não existe e o pointerenter+click do mesmo tap se
 *   anulavam (abria e fechava) — mouse usa hover, toque usa tap com toggle.
 */
export default function BarrasChart({
  dados,
  formato = "int",
  unidade,
  altura = 220,
  larguraMinCat = 44,
}: {
  dados: BarraDado[];
  /** Serializável (página server → componente client): moeda ou inteiro. */
  formato?: "brl" | "int";
  /** Sufixo do tooltip, ex.: "atendimento(s)". */
  unidade?: string;
  altura?: number;
  /** Abaixo disso o container rola horizontal (mobile, muitas categorias). */
  larguraMinCat?: number;
}) {
  const [ativo, setAtivo] = useState<number | null>(null);
  const grupoId = useId();
  if (dados.length === 0) return null;
  const fmt = (v: number) =>
    (formato === "brl" ? fmtBRL(v) : fmtInt(v)) + (unidade ? ` ${unidade}` : "");

  const max = Math.max(...dados.map((d) => d.valor), 1);
  const temDestaqueManual = dados.some((d) => d.destaque);
  const pico = Math.max(...dados.map((d) => d.valor));
  const n = dados.length;

  // Centro da coluna ativa (flex justify-around), clampado nas pontas.
  const fracAtivo =
    ativo !== null ? Math.min(0.86, Math.max(0.14, (ativo + 0.5) / n)) : 0;

  return (
    <div
      className="overflow-x-auto pb-1"
      // Toque: pointerleave dispara ao levantar o dedo — só mouse fecha.
      onPointerLeave={(e) => {
        if (e.pointerType === "mouse") setAtivo(null);
      }}
    >
      <div
        className="relative"
        style={{ height: altura, minWidth: dados.length * larguraMinCat }}
      >
        {/* grade horizontal (25/50/75/100) — sem borda externa */}
        {[0, 25, 50, 75].map((p) => (
          <div
            key={p}
            aria-hidden="true"
            className="absolute inset-x-0"
            style={{ bottom: `calc(24px + (100% - 24px) * ${p / 100})`, borderTop: `1px solid ${GRID}` }}
          />
        ))}
        <div className="absolute inset-0 flex items-end justify-around gap-2 px-1">
          {dados.map((d, i) => {
            const destaque = temDestaqueManual ? d.destaque : d.valor === pico;
            const hPct = (d.valor / max) * 100;
            return (
              <div
                key={`${grupoId}-${i}`}
                // Coluna inteira é área de toque (44px+ de alvo no mobile).
                // Mouse: hover abre. Toque: o tap alterna (abre/fecha) — sem
                // hover fantasma anulando o clique do mesmo dedo.
                onPointerEnter={(e) => {
                  if (e.pointerType === "mouse") setAtivo(i);
                }}
                onPointerDown={(e) => {
                  if (e.pointerType !== "mouse")
                    setAtivo((prev) => (prev === i ? null : i));
                }}
                className="flex h-full w-full max-w-14 cursor-pointer flex-col items-center justify-end"
              >
                <button
                  type="button"
                  aria-label={`${d.label}: ${fmt(d.valor)}`}
                  onFocus={() => setAtivo(i)}
                  onBlur={() => setAtivo(null)}
                  className="mi-chart-in relative w-full min-w-6 origin-bottom rounded-t-[6px] outline-offset-2 transition-[opacity] focus-visible:outline focus-visible:outline-2 focus-visible:outline-mi-marrom-700"
                  style={{
                    height: `calc((100% - 24px) * ${hPct / 100})`,
                    minHeight: d.valor > 0 ? 4 : 0,
                    backgroundColor: destaque ? DESTAQUE : BARRA,
                    opacity: ativo === null || ativo === i ? 1 : 0.55,
                  }}
                />
                <span
                  className="mt-1.5 block h-[18px] truncate font-corpo text-[12px]"
                  style={{ color: EIXO_TEXTO }}
                >
                  {d.label}
                </span>
              </div>
            );
          })}
        </div>

        {/* Tooltip único no topo do gráfico — dentro do clip, nunca cortado. */}
        {ativo !== null && dados[ativo] && (
          <span
            role="status"
            className="pointer-events-none absolute top-0 z-10 -translate-x-1/2 whitespace-nowrap rounded-xl bg-mi-branco px-3 py-1.5 font-corpo shadow-card ring-1 ring-mi-marrom-100"
            style={{ left: `${fracAtivo * 100}%` }}
          >
            <span className="block text-micro uppercase text-mi-marrom-700">
              {dados[ativo].label}
            </span>
            <span className="block text-rotulo font-semibold tabular-nums text-mi-marrom-900">
              {fmt(dados[ativo].valor)}
            </span>
          </span>
        )}
      </div>
    </div>
  );
}
