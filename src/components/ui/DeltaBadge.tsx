/**
 * Pílula de variação (+22% / −8%) colada ao número do KPI.
 * A cor NUNCA comunica sozinha: a seta acompanha sempre (daltônicos).
 * `inverso` = métrica em que cair é bom (despesa, no-show, cancelamento).
 */
const fmtPct = (v: number) =>
  `${Math.abs(v * 100) >= 100 ? Math.round(Math.abs(v * 100)) : (Math.abs(v * 100)).toFixed(1).replace(".", ",").replace(",0", "")}%`;

export default function DeltaBadge({
  valor,
  inverso,
  className = "",
}: {
  /** Variação relativa (0.22 = +22%). null = sem base de comparação. */
  valor: number | null;
  inverso?: boolean;
  className?: string;
}) {
  if (valor === null) {
    return (
      <span className={`font-corpo text-micro text-mi-marrom-500 ${className}`}>
        sem base anterior
      </span>
    );
  }
  const subiu = valor >= 0;
  const bom = inverso ? !subiu || valor === 0 : subiu;
  const cor = bom
    ? "bg-mi-sucesso/15 text-mi-sucesso-tinta"
    : "bg-mi-erro/15 text-mi-erro-tinta";
  return (
    <span
      className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 font-corpo text-rotulo tabular-nums ${cor} ${className}`}
    >
      <span aria-hidden="true" className="text-[10px] leading-none">
        {subiu ? "▲" : "▼"}
      </span>
      <span className="sr-only">{subiu ? "subiu" : "caiu"}</span>
      {fmtPct(valor)}
    </span>
  );
}
