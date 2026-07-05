"use client";

import { useState, useTransition, type DragEvent } from "react";
import Link from "next/link";
import { moverFunilAction, salvarValorFunilAction } from "./actions";

/**
 * F5 — kanban do funil de noiva. Arrastar e soltar no desktop; botões ◀ ▶
 * no toque (a Mi opera pelo celular — R19). Badge vermelho = parada há mais
 * de N dias na etapa (limiar da régua). Botão WhatsApp abre com rascunho da
 * etapa (a Mi sempre edita no próprio WhatsApp antes de enviar).
 */

export interface CardFunil {
  id: string;
  nome: string;
  interesse: string | null;
  etapa: string;
  diasNaEtapa: number | null;
  valorReais: number | null;
  waHref: string;
}

export interface ColunaFunil {
  etapa: string;
  label: string;
}

export default function FunilBoard({
  colunas,
  cards,
  paradaDias,
}: {
  colunas: ColunaFunil[];
  cards: CardFunil[];
  paradaDias: number;
}) {
  const [itens, setItens] = useState(cards);
  const [erro, setErro] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [sobre, setSobre] = useState<string | null>(null);
  const [editandoValor, setEditandoValor] = useState<string | null>(null);
  const [valorTmp, setValorTmp] = useState("");
  const [, startTransition] = useTransition();

  const idx = (etapa: string) => colunas.findIndex((c) => c.etapa === etapa);

  function mover(id: string, novaEtapa: string) {
    const anterior = itens;
    setItens((xs) =>
      xs.map((c) =>
        c.id === id ? { ...c, etapa: novaEtapa, diasNaEtapa: 0 } : c,
      ),
    );
    setErro(null);
    startTransition(async () => {
      const r = await moverFunilAction(id, novaEtapa);
      if (!r.ok) {
        setItens(anterior); // desfaz otimismo
        setErro(r.message);
      }
    });
  }

  function onDrop(e: DragEvent, etapa: string) {
    e.preventDefault();
    setSobre(null);
    const id = e.dataTransfer.getData("text/plain") || dragId;
    if (id) mover(id, etapa);
    setDragId(null);
  }

  function salvarValor(id: string) {
    const n = Number(valorTmp.replace(/\./g, "").replace(",", "."));
    setEditandoValor(null);
    if (!Number.isFinite(n)) return;
    setItens((xs) =>
      xs.map((c) => (c.id === id ? { ...c, valorReais: n } : c)),
    );
    startTransition(async () => {
      const r = await salvarValorFunilAction(id, n);
      if (!r.ok) setErro(r.message);
    });
  }

  return (
    <>
      {erro && (
        <p role="alert" className="mb-3 rounded-mi bg-red-50 px-4 py-3 text-sm text-red-800">
          {erro}
        </p>
      )}
      <div className="-mx-1 flex gap-3 overflow-x-auto pb-2 lg:grid lg:grid-cols-6 lg:overflow-visible">
        {colunas.map((col) => {
          const doGrupo = itens.filter((c) => c.etapa === col.etapa);
          return (
            <div
              key={col.etapa}
              onDragOver={(e) => {
                e.preventDefault();
                setSobre(col.etapa);
              }}
              onDragLeave={() => setSobre(null)}
              onDrop={(e) => onDrop(e, col.etapa)}
              className={`min-w-60 flex-1 rounded-mi p-3 transition-colors lg:min-w-0 ${
                sobre === col.etapa ? "bg-mi-marrom/15" : "bg-mi-bege/40"
              }`}
            >
              <p className="mb-2 flex items-center justify-between text-sm font-medium text-mi-marrom-escuro">
                {col.label}
                <span className="text-xs text-mi-texto/60">{doGrupo.length}</span>
              </p>
              <div className="space-y-2">
                {doGrupo.map((c) => {
                  const i = idx(c.etapa);
                  const parada =
                    c.diasNaEtapa != null && c.diasNaEtapa >= paradaDias;
                  return (
                    <div
                      key={c.id}
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData("text/plain", c.id);
                        setDragId(c.id);
                      }}
                      onDragEnd={() => setDragId(null)}
                      className={`rounded-mi bg-mi-branco px-3 py-2 text-sm shadow-suave ${
                        dragId === c.id ? "opacity-50" : ""
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <Link
                          href={`/admin/clientes/${c.id}`}
                          className="font-medium text-mi-marrom-escuro underline-offset-4 hover:underline"
                        >
                          {c.nome}
                        </Link>
                        {parada && (
                          <span
                            title={`Sem movimento há ${c.diasNaEtapa} dias`}
                            className="shrink-0 rounded bg-red-600 px-1.5 text-[10px] font-bold text-white"
                          >
                            {c.diasNaEtapa}d
                          </span>
                        )}
                      </div>
                      {c.interesse && (
                        <p className="mt-0.5 text-xs text-mi-texto/60">{c.interesse}</p>
                      )}
                      <div className="mt-1.5 flex items-center gap-1.5 text-xs">
                        {editandoValor === c.id ? (
                          <input
                            autoFocus
                            value={valorTmp}
                            onChange={(e) => setValorTmp(e.target.value)}
                            onBlur={() => salvarValor(c.id)}
                            onKeyDown={(e) => e.key === "Enter" && salvarValor(c.id)}
                            inputMode="decimal"
                            className="input-mi !w-24 !px-2 !py-1 text-xs"
                            aria-label="Valor estimado (R$)"
                          />
                        ) : (
                          <button
                            onClick={() => {
                              setEditandoValor(c.id);
                              setValorTmp(
                                c.valorReais != null ? String(c.valorReais) : "",
                              );
                            }}
                            className="rounded border border-mi-cinza px-1.5 py-0.5 text-mi-texto/70"
                            title="Valor estimado do contrato"
                          >
                            {c.valorReais != null
                              ? `R$ ${c.valorReais.toLocaleString("pt-BR")}`
                              : "+ valor"}
                          </button>
                        )}
                        <a
                          href={c.waHref}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="rounded bg-mi-marrom px-1.5 py-0.5 text-white"
                        >
                          WhatsApp
                        </a>
                        <span className="ml-auto flex gap-1">
                          <button
                            onClick={() => i > 0 && mover(c.id, colunas[i - 1]!.etapa)}
                            disabled={i <= 0}
                            aria-label="Voltar etapa"
                            className="rounded border border-mi-cinza px-1.5 py-0.5 disabled:opacity-30"
                          >
                            ◀
                          </button>
                          <button
                            onClick={() =>
                              i < colunas.length - 1 && mover(c.id, colunas[i + 1]!.etapa)
                            }
                            disabled={i >= colunas.length - 1}
                            aria-label="Avançar etapa"
                            className="rounded border border-mi-cinza px-1.5 py-0.5 disabled:opacity-30"
                          >
                            ▶
                          </button>
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
