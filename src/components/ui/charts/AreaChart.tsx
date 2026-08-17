"use client";

import { useId, useRef, useState } from "react";
import { SERIES, GRID, EIXO_TEXTO, fmtBRL, fmtInt } from "@/lib/charts/theme";

export type PontoArea = { label: string; valor: number };

const W = 600;
const H = 200;
const PAD_X = 8;
const PAD_TOP = 12;
const PAD_BOT = 26;

/**
 * Linha/área (faturamento ao longo do período). Linha 2.5px, área em
 * gradiente para transparente, pontos só no hover/toque — tooltip custom.
 * Eixo X mostra no máximo ~6 rótulos para não virar poeira no mobile.
 */
export default function AreaChart({
  dados,
  formato = "brl",
  alturaMin = 200,
}: {
  dados: PontoArea[];
  /** Serializável (página server → componente client). */
  formato?: "brl" | "int";
  alturaMin?: number;
}) {
  const [ativo, setAtivo] = useState<number | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  // useId gera ":r1:" — os dois-pontos quebram url(#...) em alguns browsers.
  const gradId = `mi-area-${useId().replace(/:/g, "")}`;

  if (dados.length === 0) return null;
  const fmt = (v: number) => (formato === "brl" ? fmtBRL(v) : fmtInt(v));

  const max = Math.max(...dados.map((d) => d.valor), 1);
  const n = dados.length;
  // n=1 (preset "Hoje"): ponto único centralizado — sem isso o path 'M x,y'
  // não desenha nada e o card parece vazio com dado existente.
  const x = (i: number) =>
    n === 1 ? W / 2 : PAD_X + (i * (W - PAD_X * 2)) / (n - 1);
  const y = (v: number) => PAD_TOP + (1 - v / max) * (H - PAD_TOP - PAD_BOT);

  const linha = dados.map((d, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(d.valor).toFixed(1)}`).join(" ");
  const area = `${linha} L${x(n - 1).toFixed(1)},${H - PAD_BOT} L${x(0).toFixed(1)},${H - PAD_BOT} Z`;

  // rótulos do eixo X: primeiro, último e ~4 intermediários — sem deixar um
  // intermediário colar no último (colisão tipo "16/8 17/8").
  const passo = Math.max(1, Math.ceil(n / 6));
  const mostraRotulo = (i: number) =>
    i === 0 ||
    i === n - 1 ||
    (i % passo === 0 && n - 1 - i >= Math.ceil(passo / 2));

  const aoMover = (clientX: number) => {
    const box = boxRef.current?.getBoundingClientRect();
    if (!box) return;
    const frac = Math.min(1, Math.max(0, (clientX - box.left) / box.width));
    setAtivo(Math.round(frac * (n - 1)));
  };

  return (
    <div
      ref={boxRef}
      className="relative"
      style={{ minHeight: alturaMin }}
      onPointerMove={(e) => aoMover(e.clientX)}
      // Toque abre no TAP completo (onClick), não ao apoiar o dedo para rolar.
      onPointerDown={(e) => {
        if (e.pointerType === "mouse") aoMover(e.clientX);
      }}
      onClick={(e) => aoMover(e.clientX)}
      // Toque: pointerleave dispara ao levantar o dedo — só mouse fecha.
      onPointerLeave={(e) => {
        if (e.pointerType === "mouse") setAtivo(null);
      }}
    >
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mi-chart-fade h-auto w-full"
        role="img"
        aria-label="Evolução no período"
        preserveAspectRatio="none"
        style={{ minHeight: alturaMin }}
      >
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={SERIES[0]} stopOpacity="0.28" />
            <stop offset="100%" stopColor={SERIES[0]} stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75, 1].map((p) => (
          <line
            key={p}
            x1={PAD_X}
            x2={W - PAD_X}
            y1={y(max * p)}
            y2={y(max * p)}
            stroke={GRID}
            strokeWidth="1"
            vectorEffect="non-scaling-stroke"
          />
        ))}
        {n > 1 && <path d={area} fill={`url(#${gradId})`} />}
        {n === 1 && (
          <circle cx={x(0)} cy={y(dados[0]!.valor)} r="5" fill={SERIES[0]} stroke="#fff" strokeWidth="2" />
        )}
        <path
          d={linha}
          fill="none"
          stroke={SERIES[0]}
          strokeWidth="2.5"
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
        {ativo !== null && dados[ativo] && (
          <>
            <line
              x1={x(ativo)}
              x2={x(ativo)}
              y1={PAD_TOP}
              y2={H - PAD_BOT}
              stroke={GRID}
              strokeWidth="1"
              vectorEffect="non-scaling-stroke"
            />
            <circle cx={x(ativo)} cy={y(dados[ativo].valor)} r="4.5" fill={SERIES[0]} stroke="#fff" strokeWidth="2" />
          </>
        )}
      </svg>
      {/* eixo X */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-between px-1">
        {dados.map((d, i) => (
          <span
            key={i}
            className="font-corpo text-[11px]"
            style={{ color: EIXO_TEXTO, visibility: mostraRotulo(i) ? "visible" : "hidden", flex: 1, textAlign: i === 0 ? "left" : i === n - 1 ? "right" : "center" }}
          >
            {d.label}
          </span>
        ))}
      </div>
      {ativo !== null && dados[ativo] && (
        <div
          role="status"
          className="pointer-events-none absolute z-10 -translate-x-1/2 rounded-xl bg-mi-branco px-3 py-1.5 font-corpo shadow-card ring-1 ring-mi-marrom-100"
          style={{
            left: `${Math.min(0.86, Math.max(0.14, n === 1 ? 0.5 : ativo / (n - 1))) * 100}%`,
            top: 0,
          }}
        >
          <span className="block whitespace-nowrap text-micro uppercase text-mi-marrom-700">
            {dados[ativo].label}
          </span>
          <span className="block whitespace-nowrap text-rotulo font-semibold tabular-nums text-mi-marrom-900">
            {fmt(dados[ativo].valor)}
          </span>
        </div>
      )}
    </div>
  );
}
