/**
 * Avaliação 1–5 em estrelas no tom da marca (V0) — prova social do guia
 * visual. Decorativo com rótulo acessível; nunca amarelo de marketplace (R12).
 */
type EstrelasProps = {
  nota: number; // 1–5
  className?: string;
};

export default function Estrelas({ nota, className = "" }: EstrelasProps) {
  const cheias = Math.max(0, Math.min(5, Math.round(nota)));
  return (
    <div
      role="img"
      aria-label={`Avaliação: ${cheias} de 5 estrelas`}
      className={`flex items-center gap-0.5 ${className}`}
    >
      {Array.from({ length: 5 }).map((_, i) => (
        <svg
          key={i}
          width="16"
          height="16"
          viewBox="0 0 24 24"
          aria-hidden="true"
          className={i < cheias ? "text-mi-marrom" : "text-mi-cinza"}
          fill="currentColor"
        >
          <path d="M12 2.5l2.95 5.98 6.6.96-4.78 4.65 1.13 6.58L12 17.57l-5.9 3.1 1.13-6.58L2.45 9.44l6.6-.96L12 2.5z" />
        </svg>
      ))}
    </div>
  );
}
