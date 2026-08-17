import type { ReactNode } from "react";

/**
 * Invólucro padrão de gráfico (V1.5): título, controle opcional à direita,
 * área do gráfico com margens generosas e legenda embaixo. `resumoA11y` é a
 * leitura do gráfico para leitor de tela (obrigatório nos gráficos de dados).
 */
export default function ChartCard({
  titulo,
  controle,
  legenda,
  resumoA11y,
  children,
  className = "",
}: {
  titulo: string;
  controle?: ReactNode;
  legenda?: ReactNode;
  resumoA11y?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-2xl border border-mi-marrom-100 bg-mi-branco p-5 shadow-card sm:p-6 ${className}`}
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-corpo text-[17px] font-semibold text-mi-marrom-900">
          {titulo}
        </h2>
        {controle}
      </div>
      {resumoA11y && <p className="sr-only">{resumoA11y}</p>}
      {children}
      {legenda && (
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5">
          {legenda}
        </div>
      )}
    </section>
  );
}
