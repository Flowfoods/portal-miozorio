import { DESTAQUE, BARRA } from "@/lib/charts/theme";

export type BarraHDado = { label: string; valor: number; extra?: string };

/**
 * Ranking em barras horizontais (serviços mais vendidos) — melhor que a
 * vertical quando o rótulo é longo. Primeiro colocado em marrom-700.
 */
export default function BarrasHChart({
  dados,
  formato = (v) => String(v),
}: {
  dados: BarraHDado[];
  formato?: (v: number) => string;
}) {
  if (dados.length === 0) return null;
  const max = Math.max(...dados.map((d) => d.valor), 1);
  return (
    <ol className="space-y-3">
      {dados.map((d, i) => (
        <li key={d.label}>
          <div className="mb-1 flex items-baseline justify-between gap-3 font-corpo text-rotulo">
            <span className="truncate text-mi-marrom-800">
              {d.label}
              {d.extra && <span className="ml-1.5 text-micro text-mi-marrom-500">{d.extra}</span>}
            </span>
            <span className="shrink-0 font-medium tabular-nums text-mi-marrom-900">
              {formato(d.valor)}
            </span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-mi-marrom-50">
            <div
              className="mi-chart-in-x h-full origin-left rounded-full"
              style={{
                width: `${(d.valor / max) * 100}%`,
                backgroundColor: i === 0 ? DESTAQUE : BARRA,
              }}
            />
          </div>
        </li>
      ))}
    </ol>
  );
}
