"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

/**
 * Toggle Caixa/Competência do financeiro. O período agora é do PeriodSelector
 * global (F3) — aqui só o regime, preservando o resto da URL (periodo/de/ate).
 */
export default function FinanceControls({
  regime,
}: {
  regime: "caixa" | "competencia";
}) {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();

  const go = (r: "caixa" | "competencia") => {
    const params = new URLSearchParams(search.toString());
    params.set("regime", r);
    router.push(`${pathname}?${params.toString()}`);
  };

  return (
    <div className="inline-flex rounded-mi bg-mi-cinza p-1 text-sm" role="group" aria-label="Regime">
      {(["caixa", "competencia"] as const).map((r) => (
        <button
          key={r}
          type="button"
          onClick={() => go(r)}
          className={`min-h-[44px] rounded-[10px] px-4 leading-9 ${
            regime === r
              ? "bg-mi-superficie-elevada text-mi-marrom-escuro shadow-suave"
              : "text-mi-marrom-800"
          }`}
        >
          {r === "caixa" ? "Caixa" : "Competência"}
        </button>
      ))}
    </div>
  );
}
