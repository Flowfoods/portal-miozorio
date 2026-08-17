import type { ReactNode } from "react";
import DeltaBadge from "./DeltaBadge";

/**
 * Card de KPI do dashboard (V1.5). Hierarquia da referência: UM card-herói
 * preenchido por tela (variant="hero"), os demais brancos. Rótulo pequeno em
 * cima, número grande e pesado, badge de variação colada ao número e legenda
 * do período em tom apagado.
 */
type StatCardProps = {
  rotulo: string;
  valor: ReactNode;
  /** Variação vs período anterior (0.22 = +22%). null = sem base; omitir = sem badge. */
  delta?: number | null;
  /** Métrica em que cair é bom (no-show, despesa...). */
  deltaInverso?: boolean;
  /** Legenda sob o número, ex.: "vs mês anterior". */
  periodo?: string;
  icone?: ReactNode;
  variant?: "default" | "hero";
  className?: string;
};

export default function StatCard({
  rotulo,
  valor,
  delta,
  deltaInverso,
  periodo,
  icone,
  variant = "default",
  className = "",
}: StatCardProps) {
  const hero = variant === "hero";
  return (
    <div
      className={`rounded-2xl p-5 sm:p-6 ${
        hero
          ? "bg-mi-marrom-700 text-mi-branco shadow-card"
          : "border border-mi-marrom-100 bg-mi-branco shadow-card"
      } ${className}`}
    >
      <div className="flex items-start justify-between gap-2">
        <p
          className={`font-corpo text-micro uppercase ${
            hero ? "text-mi-branco/85" : "text-mi-marrom-700"
          }`}
        >
          {rotulo}
        </p>
        {icone && (
          <span
            aria-hidden="true"
            className={hero ? "text-mi-branco/70" : "text-mi-marrom-400"}
          >
            {icone}
          </span>
        )}
      </div>
      <div className="mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <p
          className={`font-corpo text-kpi-sm tabular-nums md:text-kpi ${
            hero ? "text-mi-branco" : "text-mi-marrom-900"
          }`}
        >
          {valor}
        </p>
        {delta !== undefined && (
          <DeltaBadge
            valor={delta}
            inverso={deltaInverso}
            className={hero ? "bg-mi-branco/15 !text-mi-branco" : ""}
          />
        )}
      </div>
      {periodo && (
        <p
          className={`mt-1 font-corpo text-rotulo ${
            hero ? "text-mi-branco/75" : "text-mi-marrom-500"
          }`}
        >
          {periodo}
        </p>
      )}
    </div>
  );
}
