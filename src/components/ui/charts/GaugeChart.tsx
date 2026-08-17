/**
 * Gauge radial de 180° segmentado (uso ÚNICO: taxa de ocupação da agenda).
 * Ruim para precisão, ótimo para "quão cheio está" — por isso o número exato
 * vem grande no centro. Segmentos preenchidos em marrom, vazios em marrom-100.
 */
export default function GaugeChart({
  fracao,
  rotulo,
  detalhe,
}: {
  /** 0..1 */
  fracao: number;
  rotulo: string;
  detalhe?: string;
}) {
  const f = Math.min(1, Math.max(0, fracao));
  const SEGS = 21;
  const cheios = Math.round(f * SEGS);
  const W = 240;
  const H = 132;
  const cx = W / 2;
  const cy = H - 10;
  const rIn = 78;
  const rOut = 104;

  const seg = (i: number) => {
    // ângulo de 180° dividido em SEGS fatias com folga de 2.2°
    const a0 = 180 - (i * 180) / SEGS;
    const a1 = 180 - ((i + 1) * 180) / SEGS + 2.2;
    const rad = (a: number) => (a * Math.PI) / 180;
    const p = (r: number, a: number) => `${cx + r * Math.cos(rad(a))},${cy - r * Math.sin(rad(a))}`;
    return `M${p(rIn, a0)} L${p(rOut, a0)} A${rOut} ${rOut} 0 0 1 ${p(rOut, a1)} L${p(rIn, a1)} A${rIn} ${rIn} 0 0 0 ${p(rIn, a0)} Z`;
  };

  return (
    <div className="flex flex-col items-center">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mi-chart-fade h-auto w-full max-w-[280px]"
        role="img"
        aria-label={`${rotulo}: ${Math.round(f * 100)}%`}
      >
        {Array.from({ length: SEGS }, (_, i) => (
          <path
            key={i}
            d={seg(i)}
            fill={i < cheios ? "#8A7361" : "#EDE6E0"}
            opacity={i < cheios ? 0.55 + 0.45 * (i / SEGS) : 1}
          />
        ))}
        <text
          x={cx}
          y={cy - 18}
          textAnchor="middle"
          fontSize="34"
          fontWeight="700"
          fill="#332B24"
          className="tabular-nums"
        >
          {Math.round(f * 100)}%
        </text>
        <text x={cx} y={cy + 2} textAnchor="middle" fontSize="11" fill="#6B5849">
          {rotulo}
        </text>
      </svg>
      {detalhe && (
        <p className="mt-1 text-center font-corpo text-rotulo text-mi-marrom-700">{detalhe}</p>
      )}
    </div>
  );
}
