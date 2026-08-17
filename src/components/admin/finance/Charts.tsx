import type { PontoSerie } from "@/lib/finance/queries";
import { SERIES, GRID, EIXO_TEXTO } from "@/lib/charts/theme";

/**
 * Barras agrupadas Receita × Despesa por mês + linha de Resultado.
 * SVG puro (zero dependência, SSR-friendly), no tema único de gráficos (V2):
 * receita = sálvia (3ª cor da paleta), despesa = terracota (4ª), resultado =
 * marrom-900. Topo arredondado, grade só horizontal, eixo sem linha.
 */
const RECEITA = SERIES[2]; // sálvia
const DESPESA = SERIES[3]; // terracota
const RESULTADO = "#332B24"; // mi-marrom-900
const NEGATIVO = "#7E3A35"; // mi-erro-tinta

export function BarrasReceitaDespesa({ serie }: { serie: PontoSerie[] }) {
  const W = 720;
  const H = 280;
  const padX = 36;
  const padTop = 24;
  const padBottom = 34;
  const innerW = W - padX * 2;
  const innerH = H - padTop - padBottom;

  if (serie.length === 0) {
    return (
      <p className="rounded-mi bg-mi-marrom-50 p-8 text-center font-corpo text-rotulo text-mi-marrom-700">
        Sem dados no período.
      </p>
    );
  }

  const maxPos = Math.max(
    1,
    ...serie.map((p) => Math.max(p.receitaCents, p.despesaCents, p.resultadoCents)),
  );
  const minNeg = Math.min(0, ...serie.map((p) => p.resultadoCents));
  const domain = maxPos - minNeg;
  const y = (v: number) => padTop + ((maxPos - v) / domain) * innerH;
  const baseline = y(0);

  const groupW = innerW / serie.length;
  const barW = Math.min(34, groupW * 0.3);

  const pts = serie.map((p, i) => {
    const cx = padX + groupW * (i + 0.5);
    return { cx, cy: y(p.resultadoCents), v: p.resultadoCents };
  });
  const linePath = pts
    .map((p, i) => `${i === 0 ? "M" : "L"}${p.cx.toFixed(1)},${p.cy.toFixed(1)}`)
    .join(" ");

  return (
    <div className="overflow-x-auto">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mi-chart-fade h-auto w-full min-w-[560px]"
        role="img"
        aria-label="Receita versus despesa por mês com linha de resultado"
      >
        {/* grade horizontal discreta acima da baseline */}
        {[0.25, 0.5, 0.75, 1].map((f) => (
          <line
            key={f}
            x1={padX}
            x2={W - padX}
            y1={y(maxPos * f)}
            y2={y(maxPos * f)}
            stroke={GRID}
            strokeWidth="1"
          />
        ))}
        <line x1={padX} y1={baseline} x2={W - padX} y2={baseline} stroke={GRID} strokeWidth="1" />
        {serie.map((p, i) => {
          const gx = padX + groupW * i;
          const cRec = gx + groupW / 2 - barW - 2;
          const cDes = gx + groupW / 2 + 2;
          return (
            <g key={`${p.ano}-${p.mes}`}>
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
              <text x={gx + groupW / 2} y={H - 12} textAnchor="middle" fontSize="12" fill={EIXO_TEXTO}>
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
            r="3.5"
            fill={p.v >= 0 ? RESULTADO : NEGATIVO}
            stroke="#fff"
            strokeWidth="1.5"
          />
        ))}
      </svg>
      <div className="mt-2 flex flex-wrap gap-4 px-1 font-corpo text-rotulo text-mi-marrom-700">
        <Legenda cor={RECEITA} rotulo="Receita" />
        <Legenda cor={DESPESA} rotulo="Despesa" />
        <Legenda cor={RESULTADO} rotulo="Resultado" linha />
      </div>
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
