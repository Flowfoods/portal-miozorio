"use client";

import { useState } from "react";
import type { ReferralScope } from "@/lib/settings";

/**
 * Config da regra de indicação PERCENTUAL (admin). Campo de %, seletor de escopo
 * com explicação em linguagem simples, liga/desliga e PREVIEW AO VIVO. Espelha a
 * regra de cálculo do servidor: floor(base × %), com piso de 1 ponto se > 0.
 */
export default function RegraIndicacaoForm({
  percentualInicial,
  escopoInicial,
  ativoInicial,
  action,
}: {
  percentualInicial: number;
  escopoInicial: ReferralScope;
  ativoInicial: boolean;
  action: (formData: FormData) => void | Promise<void>;
}) {
  const [percentual, setPercentual] = useState(String(percentualInicial));
  const [escopo, setEscopo] = useState<ReferralScope>(escopoInicial);
  const [ativo, setAtivo] = useState(ativoInicial);

  const pct = Math.min(
    100,
    Math.max(0, Number(percentual.replace(",", ".")) || 0),
  );
  const BASE_EXEMPLO = 150;
  const bruto = (BASE_EXEMPLO * pct) / 100;
  const bonusExemplo = bruto <= 0 ? 0 : bruto < 1 ? 1 : Math.floor(bruto);

  return (
    <form action={action} className="space-y-4">
      <div className="flex flex-wrap items-end gap-4">
        <label className="text-xs">
          Percentual repassado à indicadora
          <div className="mt-1 flex items-center gap-1">
            <input
              className="input-mi w-24 !py-2"
              name="percentual"
              type="number"
              min={0}
              max={100}
              step="0.5"
              inputMode="decimal"
              value={percentual}
              onChange={(e) => setPercentual(e.target.value)}
            />
            <span className="text-sm text-mi-texto/80">%</span>
          </div>
        </label>

        <label className="flex items-center gap-2 pb-2 text-xs">
          <input
            type="checkbox"
            name="ativo"
            checked={ativo}
            onChange={(e) => setAtivo(e.target.checked)}
            className="h-4 w-4 accent-mi-marrom"
          />
          Programa de indicação ligado
        </label>
      </div>

      <fieldset className="text-xs">
        <legend className="mb-1 text-mi-texto/80">
          Quando a indicadora ganha pontos
        </legend>
        <label className="flex items-start gap-2 py-1">
          <input
            type="radio"
            name="escopo"
            value="PRIMEIRO_ATENDIMENTO"
            checked={escopo === "PRIMEIRO_ATENDIMENTO"}
            onChange={() => setEscopo("PRIMEIRO_ATENDIMENTO")}
            className="mt-0.5 accent-mi-marrom"
          />
          <span>
            <strong>Só no 1º atendimento</strong> da amiga indicada. Depois
            disso, o vínculo continua, mas não gera mais pontos.
          </span>
        </label>
        <label className="flex items-start gap-2 py-1">
          <input
            type="radio"
            name="escopo"
            value="TODOS_ATENDIMENTOS"
            checked={escopo === "TODOS_ATENDIMENTOS"}
            onChange={() => setEscopo("TODOS_ATENDIMENTOS")}
            className="mt-0.5 accent-mi-marrom"
          />
          <span>
            <strong>Em todos os atendimentos</strong> da amiga indicada, sempre
            que ela se cuidar com a Mi.
          </span>
        </label>
      </fieldset>

      {/* Preview ao vivo — espelha a regra do servidor (floor, piso de 1). */}
      <p className="rounded-mi bg-mi-cinza/40 px-3 py-2 text-xs text-mi-texto/80">
        Ex.: indicada ganha <strong>{BASE_EXEMPLO} pts</strong> → indicadora
        ganha <strong>{bonusExemplo} pts</strong>
        {!ativo && " (programa desligado no momento)"}
      </p>

      <button className="rounded-mi bg-mi-marrom-escuro px-4 py-2 text-sm text-white">
        Salvar regra de indicação
      </button>
    </form>
  );
}
