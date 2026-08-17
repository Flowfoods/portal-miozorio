import { SERIES, agruparFatias, type Fatia } from "@/lib/charts/theme";

/**
 * Rosca de composição (distribuição por tipo de serviço etc.). Espessura
 * 24px, total no centro, NUNCA mais de 6 fatias (excedente vira "Outros").
 * Cores na ordem fixa da paleta de dados — não a cor do banco, para todo
 * gráfico do portal contar a mesma história visual.
 */
export default function RoscaChart({
  fatias,
  formatoTotal = (v) => String(v),
  formatoItem,
}: {
  fatias: Fatia[];
  formatoTotal?: (total: number) => string;
  formatoItem?: (v: number) => string;
}) {
  const dados = agruparFatias(fatias);
  const total = dados.reduce((a, f) => a + f.valor, 0);
  if (total === 0) return null;

  const size = 168;
  const r = (size - 24) / 2 - 4;
  const cx = size / 2;
  const cy = size / 2;
  const C = 2 * Math.PI * r;
  let acc = 0;

  return (
    <div className="flex flex-wrap items-center gap-5">
      <svg
        viewBox={`0 0 ${size} ${size}`}
        width={size}
        height={size}
        role="img"
        aria-label={`Distribuição: ${dados.map((f) => `${f.label} ${Math.round((f.valor / total) * 100)}%`).join(", ")}`}
        className="mi-chart-fade shrink-0"
      >
        {dados.map((f, i) => {
          const len = (f.valor / total) * C;
          const seg = (
            <circle
              key={i}
              cx={cx}
              cy={cy}
              r={r}
              fill="none"
              stroke={SERIES[i % SERIES.length]}
              strokeWidth="24"
              strokeDasharray={`${Math.max(0, len - 2)} ${C - Math.max(0, len - 2)}`}
              strokeDashoffset={-acc}
              transform={`rotate(-90 ${cx} ${cy})`}
            />
          );
          acc += len;
          return seg;
        })}
        <text
          x={cx}
          y={cy - 3}
          textAnchor="middle"
          className="font-corpo"
          fontSize="17"
          fontWeight="700"
          fill="#332B24"
        >
          {formatoTotal(total)}
        </text>
        <text x={cx} y={cy + 15} textAnchor="middle" fontSize="10" fill="#6B5849">
          total
        </text>
      </svg>
      <ul className="min-w-[150px] flex-1 space-y-1.5">
        {dados.map((f, i) => (
          <li key={f.label} className="flex items-center justify-between gap-2 font-corpo text-rotulo">
            <span className="inline-flex min-w-0 items-center gap-2">
              <span
                aria-hidden="true"
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: SERIES[i % SERIES.length] }}
              />
              <span className="truncate text-mi-marrom-800">{f.label}</span>
            </span>
            <span className="shrink-0 tabular-nums text-mi-marrom-700">
              {formatoItem ? formatoItem(f.valor) : `${Math.round((f.valor / total) * 100)}%`}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
