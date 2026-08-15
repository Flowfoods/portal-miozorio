import { formatBRL } from "@/lib/format";
import type { PontoSerie } from "@/lib/finance/queries";

/**
 * Gráficos do Financeiro em SVG puro (zero dependência, SSR-friendly, on-brand).
 * Cores via tokens da Mi. Sem interatividade — leitura clara em telas pequenas.
 */

const RECEITA = "#7C9A6B"; // verde sóbrio
const DESPESA = "#B5705A"; // terracota (acento quente)
const LUCRO = "#5C8A4E";
const PREJUIZO = "#B5485A";
const EIXO = "#C9BFB2";

/** Barras agrupadas Receita × Despesa por mês + linha de Resultado. */
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
      <p className="rounded-mi bg-mi-superficie-elevada p-8 text-center text-sm text-mi-texto/80 shadow-suave">
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

  // Linha de resultado (centro de cada grupo).
  const pts = serie.map((p, i) => {
    const cx = padX + groupW * (i + 0.5);
    return { cx, cy: y(p.resultadoCents), v: p.resultadoCents };
  });
  const linePath = pts
    .map((p, i) => `${i === 0 ? "M" : "L"}${p.cx.toFixed(1)},${p.cy.toFixed(1)}`)
    .join(" ");

  return (
    <div className="overflow-x-auto rounded-mi bg-mi-superficie-elevada p-4 shadow-suave">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-auto w-full min-w-[560px]"
        role="img"
        aria-label="Receita versus despesa por mês com linha de resultado"
      >
        {/* baseline */}
        <line x1={padX} y1={baseline} x2={W - padX} y2={baseline} stroke={EIXO} strokeWidth="1" />
        {serie.map((p, i) => {
          const gx = padX + groupW * i;
          const cRec = gx + groupW / 2 - barW - 2;
          const cDes = gx + groupW / 2 + 2;
          return (
            <g key={`${p.ano}-${p.mes}`}>
              <rect x={cRec} y={y(p.receitaCents)} width={barW} height={Math.max(0, baseline - y(p.receitaCents))} fill={RECEITA} rx="2" />
              <rect x={cDes} y={y(p.despesaCents)} width={barW} height={Math.max(0, baseline - y(p.despesaCents))} fill={DESPESA} rx="2" />
              <text x={gx + groupW / 2} y={H - 14} textAnchor="middle" fontSize="11" fill="#3D3733">
                {p.label}
              </text>
            </g>
          );
        })}
        {/* linha de resultado */}
        <path d={linePath} fill="none" stroke="#5C4A3D" strokeWidth="2" strokeLinejoin="round" />
        {pts.map((p, i) => (
          <circle key={i} cx={p.cx} cy={p.cy} r="3.5" fill={p.v >= 0 ? LUCRO : PREJUIZO} stroke="#fff" strokeWidth="1.5" />
        ))}
      </svg>
      <div className="mt-2 flex flex-wrap gap-4 px-1 text-xs text-mi-texto/80">
        <Legenda cor={RECEITA} rotulo="Receita" />
        <Legenda cor={DESPESA} rotulo="Despesa" />
        <Legenda cor="#5C4A3D" rotulo="Resultado" linha />
      </div>
    </div>
  );
}

function Legenda({ cor, rotulo, linha }: { cor: string; rotulo: string; linha?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className={linha ? "inline-block h-[3px] w-4 rounded" : "inline-block h-3 w-3 rounded-sm"}
        style={{ backgroundColor: cor }}
      />
      {rotulo}
    </span>
  );
}

export interface FatiaDonut {
  label: string;
  cents: number;
  color: string;
}

/** Donut de composição (despesa por categoria / receita por origem). */
export function Donut({
  fatias,
  titulo,
}: {
  fatias: FatiaDonut[];
  titulo: string;
}) {
  const total = fatias.reduce((a, f) => a + f.cents, 0);
  const size = 160;
  const r = 64;
  const cx = size / 2;
  const cy = size / 2;
  const C = 2 * Math.PI * r;

  let acc = 0;
  return (
    <div className="rounded-mi bg-mi-superficie-elevada p-4 shadow-suave">
      <p className="mb-3 font-corpo text-sm text-mi-texto/80">{titulo}</p>
      {total === 0 ? (
        <p className="py-8 text-center text-sm text-mi-texto/80">
          Nada lançado neste mês.
        </p>
      ) : (
        <div className="flex flex-wrap items-center gap-4">
          <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} role="img" aria-label={titulo}>
            <circle cx={cx} cy={cy} r={r} fill="none" stroke="#EFE9E0" strokeWidth="18" />
            {fatias.map((f, i) => {
              const len = (f.cents / total) * C;
              const seg = (
                <circle
                  key={i}
                  cx={cx}
                  cy={cy}
                  r={r}
                  fill="none"
                  stroke={f.color}
                  strokeWidth="18"
                  strokeDasharray={`${len} ${C - len}`}
                  strokeDashoffset={-acc}
                  transform={`rotate(-90 ${cx} ${cy})`}
                />
              );
              acc += len;
              return seg;
            })}
            <text x={cx} y={cy - 2} textAnchor="middle" fontSize="13" fontWeight="600" fill="#5C4A3D">
              {formatBRL(total)}
            </text>
            <text x={cx} y={cy + 14} textAnchor="middle" fontSize="9" fill="#8A7361">
              total
            </text>
          </svg>
          <ul className="min-w-[140px] flex-1 space-y-1 text-xs">
            {fatias.map((f, i) => (
              <li key={i} className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 truncate">
                  <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: f.color }} />
                  <span className="truncate text-mi-texto/80">{f.label}</span>
                </span>
                <span className="shrink-0 text-mi-texto/80">
                  {Math.round((f.cents / total) * 100)}%
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
