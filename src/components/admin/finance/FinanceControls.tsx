"use client";

import { useRouter } from "next/navigation";

/**
 * Controles do dashboard financeiro: seletor de mês + toggle Caixa/Competência.
 * Atualiza a URL (?mes=YYYY-MM&regime=) — o server component relê e recalcula.
 */
export default function FinanceControls({
  mes,
  regime,
}: {
  mes: string;
  regime: "caixa" | "competencia";
}) {
  const router = useRouter();
  const go = (next: { mes?: string; regime?: string }) => {
    const params = new URLSearchParams({ mes, regime, ...next });
    router.push(`/admin/financeiro?${params.toString()}`);
  };

  return (
    <div className="flex flex-wrap items-center gap-3">
      <input
        type="month"
        value={mes}
        onChange={(e) => go({ mes: e.target.value })}
        aria-label="Mês"
        className="input-mi !w-auto !py-2"
      />
      <div className="inline-flex rounded-mi bg-mi-cinza p-1 text-sm" role="group" aria-label="Regime">
        {(["caixa", "competencia"] as const).map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => go({ regime: r })}
            className={`min-h-[36px] rounded-[10px] px-4 leading-9 ${
              regime === r
                ? "bg-mi-superficie-elevada text-mi-marrom-escuro shadow-suave"
                : "text-mi-marrom"
            }`}
          >
            {r === "caixa" ? "Caixa" : "Competência"}
          </button>
        ))}
      </div>
    </div>
  );
}
