"use client";

import { useEffect, useRef, useState } from "react";
import type { PontoSerie } from "@/lib/finance/queries";
import { formatBRL } from "@/lib/format";
import { SERIES, GRID, EIXO_TEXTO } from "@/lib/charts/theme";

/**
 * Barras agrupadas Receita × Despesa por mês + linha de Resultado, no padrão
 * V2: tooltip por toque/hover com os três valores do mês, legenda SEMPRE
 * visível (fora do container de scroll — dentro dele, rolar o gráfico levava
 * a legenda embora, achado do QA em produção 17/08) e abertura já rolada para
 * os meses mais recentes no celular.
 */
const RECEITA = SERIES[2]; // sálvia
const DESPESA = SERIES[3]; // terracota
const RESULTADO = "#332B24"; // mi-marrom-900
const NEGATIVO = "#7E3A35"; // mi-erro-tinta

const W = 720;
const H = 280;
const PAD_X = 36;
const PAD_TOP = 24;
const PAD_BOTTOM = 34;

export function BarrasReceitaDespesa({ serie }: { serie: PontoSerie[] }) {
  const [ativo, setAtivo] = useState<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);

  // Os meses recentes são os que importam: abre com o fim da série à vista.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollLeft = el.scrollWidth;
  }, []);

  if (serie.length === 0) {
    return (
      <p className="rounded-mi bg-mi-marrom-50 p-8 text-center font-corpo text-rotulo text-mi-marrom-700">
        Sem dados no período.
      </p>
    );
  }

  const innerW = W - PAD_X * 2;
  const innerH = H - PAD_TOP - PAD_BOTTOM;
  const maxPos = Math.max(
    1,
    ...serie.map((p) => Math.max(p.receitaCents, p.despesaCents, p.resultadoCents)),
  );
  const minNeg = Math.min(0, ...serie.map((p) => p.resultadoCents));
  const domain = maxPos - minNeg;
  const y = (v: number) => PAD_TOP + ((maxPos - v) / domain) * innerH;
  const baseline = y(0);

  const groupW = innerW / serie.length;
  const barW = Math.min(34, groupW * 0.3);
  const centro = (i: number) => PAD_X + groupW * (i + 0.5);

  const pts = serie.map((p, i) => ({ cx: centro(i), cy: y(p.resultadoCents), v: p.resultadoCents }));
  const linePath = pts
    .map((p, i) => `${i === 0 ? "M" : "L"}${p.cx.toFixed(1)},${p.cy.toFixed(1)}`)
    .join(" ");

  const aoMover = (clientX: number) => {
    const box = innerRef.current?.getBoundingClientRect();
    if (!box) return;
    const xNoViewBox = ((clientX - box.left) / box.width) * W;
    const i = Math.min(
      serie.length - 1,
      Math.max(0, Math.floor((xNoViewBox - PAD_X) / groupW)),
    );
    setAtivo(i);
  };

  const mesAtivo = ativo !== null ? serie[ativo] : null;
  // Tooltip clampada para não vazar do card nas pontas.
  const fracAtivo =
    ativo !== null ? Math.min(0.86, Math.max(0.14, centro(ativo) / W)) : 0;

  return (
    <div>
      <div ref={scrollRef} className="overflow-x-auto">
        <div
          ref={innerRef}
          className="relative min-w-[560px]"
          onPointerMove={(e) => aoMover(e.clientX)}
          // Toque abre no TAP completo (onClick), não ao apoiar o dedo p/ rolar.
          onPointerDown={(e) => {
            if (e.pointerType === "mouse") aoMover(e.clientX);
          }}
          onClick={(e) => aoMover(e.clientX)}
          // No toque, o pointerleave dispara assim que o dedo levanta — só o
          // mouse fecha o tooltip ao sair; no celular ele fica até o próximo toque.
          onPointerLeave={(e) => {
            if (e.pointerType === "mouse") setAtivo(null);
          }}
        >
          <svg
            viewBox={`0 0 ${W} ${H}`}
            className="mi-chart-fade h-auto w-full"
            role="img"
            aria-label="Receita versus despesa por mês com linha de resultado"
          >
            {[0.25, 0.5, 0.75, 1].map((f) => (
              <line
                key={f}
                x1={PAD_X}
                x2={W - PAD_X}
                y1={y(maxPos * f)}
                y2={y(maxPos * f)}
                stroke={GRID}
                strokeWidth="1"
              />
            ))}
            <line x1={PAD_X} y1={baseline} x2={W - PAD_X} y2={baseline} stroke={GRID} strokeWidth="1" />
            {serie.map((p, i) => {
              const gx = PAD_X + groupW * i;
              const cRec = gx + groupW / 2 - barW - 2;
              const cDes = gx + groupW / 2 + 2;
              const apagado = ativo !== null && ativo !== i;
              return (
                <g key={`${p.ano}-${p.mes}`} opacity={apagado ? 0.45 : 1}>
                  {/* coluna clicável invisível — alvo de toque do mês inteiro */}
                  <rect x={gx} y={PAD_TOP} width={groupW} height={innerH} fill="transparent" />
                  <rect
                    x={cRec}
                    y={y(p.receitaCents)}
                    width={barW}
                    height={Math.max(0, baseline - y(p.receitaCents))}
                    fill={RECEITA}
                    rx="6"
                  />
                  <rect
                    x={cDes}
                    y={y(p.despesaCents)}
                    width={barW}
                    height={Math.max(0, baseline - y(p.despesaCents))}
                    fill={DESPESA}
                    rx="6"
                  />
                  <text
                    x={gx + groupW / 2}
                    y={H - 12}
                    textAnchor="middle"
                    fontSize="12"
                    fill={EIXO_TEXTO}
                    fontWeight={ativo === i ? "600" : "400"}
                  >
                    {p.label}
                  </text>
                </g>
              );
            })}
            <path d={linePath} fill="none" stroke={RESULTADO} strokeWidth="2.5" strokeLinejoin="round" />
            {pts.map((p, i) => (
              <circle
                key={i}
                cx={p.cx}
                cy={p.cy}
                r={ativo === i ? 5 : 3.5}
                fill={p.v >= 0 ? RESULTADO : NEGATIVO}
                stroke="#fff"
                strokeWidth="1.5"
              />
            ))}
          </svg>

          {mesAtivo && (
            <div
              role="status"
              className="pointer-events-none absolute top-1 z-10 -translate-x-1/2 rounded-xl bg-mi-branco px-3 py-2 font-corpo shadow-card ring-1 ring-mi-marrom-100"
              style={{ left: `${fracAtivo * 100}%` }}
            >
              <p className="mb-1 text-micro font-medium uppercase text-mi-marrom-700">
                {mesAtivo.label}
              </p>
              <dl className="space-y-0.5 whitespace-nowrap text-rotulo tabular-nums">
                <Linha cor={RECEITA} rotulo="Receita" valor={mesAtivo.receitaCents} />
                <Linha cor={DESPESA} rotulo="Despesa" valor={mesAtivo.despesaCents} />
                <Linha
                  cor={mesAtivo.resultadoCents >= 0 ? RESULTADO : NEGATIVO}
                  rotulo="Resultado"
                  valor={mesAtivo.resultadoCents}
                  forte
                />
              </dl>
            </div>
          )}
        </div>
      </div>

      {/* Legenda FORA do scroll: sempre visível, role o gráfico quanto rolar. */}
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 px-1 font-corpo text-rotulo text-mi-marrom-700">
        <Legenda cor={RECEITA} rotulo="Receita" />
        <Legenda cor={DESPESA} rotulo="Despesa" />
        <Legenda cor={RESULTADO} rotulo="Resultado" linha />
      </div>
    </div>
  );
}

function Linha({
  cor,
  rotulo,
  valor,
  forte,
}: {
  cor: string;
  rotulo: string;
  valor: number;
  forte?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="inline-flex items-center gap-1.5 text-mi-marrom-700">
        <span
          aria-hidden="true"
          className="inline-block h-2 w-2 rounded-full"
          style={{ backgroundColor: cor }}
        />
        {rotulo}
      </span>
      <span className={forte ? "font-semibold text-mi-marrom-900" : "text-mi-marrom-800"}>
        {formatBRL(valor)}
      </span>
    </div>
  );
}

function Legenda({ cor, rotulo, linha }: { cor: string; rotulo: string; linha?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        aria-hidden="true"
        className={linha ? "inline-block h-[3px] w-4 rounded" : "inline-block h-3 w-3 rounded"}
        style={{ backgroundColor: cor }}
      />
      {rotulo}
    </span>
  );
}
