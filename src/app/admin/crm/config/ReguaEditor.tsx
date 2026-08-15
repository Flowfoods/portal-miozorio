"use client";

import { useState, useTransition } from "react";
import type { CrmConfigData, RegraSegmento } from "@/lib/crm-config";
import {
  previewCrmConfigAction,
  saveCrmConfigAction,
  recalcularAgoraAction,
} from "./actions";

/**
 * Editor da régua RFV (CRM 2.0 F2) — linguagem leiga (R13), mobile-first (R19).
 * Valores em R$ na tela; centavos só no payload. Prévia nunca grava.
 */

type Cortes = [number, number, number, number];

const NOTAS = [1, 2, 3, 4, 5] as const;

interface Props {
  initial: CrmConfigData;
}

export default function ReguaEditor({ initial }: Props) {
  const [janela, setJanela] = useState(initial.janelaMeses);
  const [rec, setRec] = useState<Cortes>([...initial.recenciaDias]);
  const [freq, setFreq] = useState<Cortes>([...initial.frequencia]);
  const [valorReais, setValorReais] = useState<Cortes>(
    initial.valorCents.map((c) => Math.round(c / 100)) as Cortes,
  );
  const [regras, setRegras] = useState<RegraSegmento[]>(
    initial.segmentos.map((s) => ({ ...s })),
  );
  const [sumida, setSumida] = useState(initial.limiares.sumidaDias);
  const [reguas, setReguas] = useState(initial.reguas);
  const [leadFria, setLeadFria] = useState(initial.limiares.leadFriaDias);
  const [abandono, setAbandono] = useState(initial.limiares.abandonoTentativas);
  const [funilParada, setFunilParada] = useState(
    initial.limiares.funilParadaDias,
  );
  const [retencao, setRetencao] = useState(
    initial.limiares.retencaoEventosMeses,
  );

  const [preview, setPreview] = useState<{
    base: number;
    porSegmento: Record<string, number>;
  } | null>(null);
  const [msg, setMsg] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(
    null,
  );
  const [pending, startTransition] = useTransition();

  function montarPayload(): CrmConfigData {
    return {
      janelaMeses: janela,
      recenciaDias: rec,
      frequencia: freq,
      valorCents: valorReais.map((v) => Math.round(v * 100)) as Cortes,
      segmentos: regras,
      limiares: {
        sumidaDias: sumida,
        leadFriaDias: leadFria,
        abandonoTentativas: abandono,
        funilParadaDias: funilParada,
        retencaoEventosMeses: retencao,
      },
      reguas,
    };
  }

  function verPrevia() {
    setMsg(null);
    startTransition(async () => {
      const r = await previewCrmConfigAction(montarPayload());
      if (r.ok) setPreview({ base: r.base, porSegmento: r.porSegmento });
      else {
        setPreview(null);
        setMsg({ tipo: "erro", texto: r.message });
      }
    });
  }

  function salvar() {
    setMsg(null);
    startTransition(async () => {
      const r = await saveCrmConfigAction(montarPayload());
      if (r.ok) {
        setPreview(null);
        setMsg({
          tipo: "ok",
          texto: "Régua salva 💛 As clientes já foram reclassificadas.",
        });
      } else setMsg({ tipo: "erro", texto: r.message });
    });
  }

  function recalcular() {
    setMsg(null);
    startTransition(async () => {
      const r = await recalcularAgoraAction();
      setMsg(
        r.ok
          ? { tipo: "ok", texto: `Pronto — ${r.base} cliente(s) reclassificada(s).` }
          : { tipo: "erro", texto: r.message },
      );
    });
  }

  // ── helpers de UI ──────────────────────────────────────────────────────────

  const numInput = (
    value: number,
    onChange: (n: number) => void,
    extra = "",
  ) => (
    <input
      type="number"
      min={0}
      value={Number.isFinite(value) ? value : ""}
      onChange={(e) => onChange(Number(e.target.value))}
      className={`input-mi !w-24 !py-2 text-center ${extra}`}
    />
  );

  function setCorte(
    setter: (c: Cortes) => void,
    atual: Cortes,
    i: number,
    v: number,
  ) {
    const c = [...atual] as Cortes;
    c[i] = v;
    setter(c);
  }

  const notaSelect = (
    value: number | undefined,
    onChange: (n: number | undefined) => void,
  ) => (
    <select
      value={value ?? ""}
      onChange={(e) =>
        onChange(e.target.value === "" ? undefined : Number(e.target.value))
      }
      className="input-mi !w-16 !px-2 !py-1.5 text-center"
    >
      <option value="">—</option>
      {NOTAS.map((n) => (
        <option key={n} value={n}>
          {n}
        </option>
      ))}
    </select>
  );

  function mudarRegra(i: number, patch: Partial<RegraSegmento>) {
    setRegras((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  }
  function moverRegra(i: number, delta: -1 | 1) {
    setRegras((rs) => {
      const j = i + delta;
      if (j < 0 || j >= rs.length) return rs;
      const copy = [...rs];
      [copy[i], copy[j]] = [copy[j]!, copy[i]!];
      return copy;
    });
  }

  return (
    <div className="space-y-8">
      {/* Janela */}
      <section className="rounded-mi bg-mi-branco p-4 shadow-suave">
        <h2 className="text-lg">Período de análise</h2>
        <p className="mt-1 text-sm text-mi-texto/70">
          Visitas e valor gasto contam dentro deste período.
        </p>
        <label className="mt-3 flex items-center gap-2 text-sm">
          Últimos {numInput(janela, setJanela)} meses
        </label>
      </section>

      {/* Recência */}
      <section className="rounded-mi bg-mi-branco p-4 shadow-suave">
        <h2 className="text-lg">Recência — dias desde a última visita</h2>
        <p className="mt-1 text-sm text-mi-texto/70">
          Quanto mais recente, maior a nota (1 a 5).
        </p>
        <div className="mt-3 space-y-2 text-sm">
          {([5, 4, 3, 2] as const).map((nota, i) => (
            <label key={nota} className="flex items-center gap-2">
              <span className="w-14 font-medium">Nota {nota}</span> até{" "}
              {numInput(rec[i]!, (v) => setCorte(setRec, rec, i, v))} dias
            </label>
          ))}
          <p className="text-mi-texto/60">
            Nota 1: mais de {rec[3]} dias sem visitar.
          </p>
        </div>
      </section>

      {/* Frequência */}
      <section className="rounded-mi bg-mi-branco p-4 shadow-suave">
        <h2 className="text-lg">Frequência — atendimentos no período</h2>
        <div className="mt-3 space-y-2 text-sm">
          {([2, 3, 4, 5] as const).map((nota, i) => (
            <label key={nota} className="flex items-center gap-2">
              <span className="w-14 font-medium">Nota {nota}</span> a partir de{" "}
              {numInput(freq[i]!, (v) => setCorte(setFreq, freq, i, v))}{" "}
              atendimento(s)
            </label>
          ))}
          <p className="text-mi-texto/60">Nota 1: abaixo de {freq[0]}.</p>
        </div>
      </section>

      {/* Valor */}
      <section className="rounded-mi bg-mi-branco p-4 shadow-suave">
        <h2 className="text-lg">Valor — total gasto no período</h2>
        <div className="mt-3 space-y-2 text-sm">
          {([2, 3, 4, 5] as const).map((nota, i) => (
            <label key={nota} className="flex items-center gap-2">
              <span className="w-14 font-medium">Nota {nota}</span> a partir de
              R${" "}
              {numInput(valorReais[i]!, (v) =>
                setCorte(setValorReais, valorReais, i, v),
              )}
            </label>
          ))}
          <p className="text-mi-texto/60">Nota 1: abaixo de R${valorReais[0]}.</p>
        </div>
      </section>

      {/* Segmentos */}
      <section className="rounded-mi bg-mi-branco p-4 shadow-suave">
        <h2 className="text-lg">Segmentos</h2>
        <p className="mt-1 text-sm text-mi-texto/70">
          A primeira linha que combinar com as notas da cliente define o
          segmento dela. Pode repetir o mesmo nome em mais de uma linha. Se
          nenhuma combinar, vale a última.
        </p>
        <div className="mt-4 space-y-3">
          {regras.map((r, i) => (
            <div
              key={i}
              className="rounded-mi border border-mi-cinza p-3 text-sm"
            >
              <div className="flex flex-wrap items-center gap-2">
                <input
                  value={r.nome}
                  onChange={(e) => mudarRegra(i, { nome: e.target.value })}
                  className="input-mi !w-40 !py-1.5"
                  placeholder="Nome do segmento"
                />
                <span className="ml-auto flex gap-1">
                  <button
                    type="button"
                    onClick={() => moverRegra(i, -1)}
                    className="rounded-mi border border-mi-cinza px-2 py-1"
                    aria-label="Subir"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    onClick={() => moverRegra(i, 1)}
                    className="rounded-mi border border-mi-cinza px-2 py-1"
                    aria-label="Descer"
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setRegras((rs) => rs.filter((_, j) => j !== i))
                    }
                    className="rounded-mi border border-mi-cinza px-2 py-1 text-red-800"
                    aria-label="Remover"
                  >
                    ✕
                  </button>
                </span>
              </div>
              <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
                <label className="flex flex-col gap-1">
                  Recência (mín–máx)
                  <span className="flex items-center gap-1">
                    {notaSelect(r.rMin, (n) => mudarRegra(i, { rMin: n }))}–
                    {notaSelect(r.rMax, (n) => mudarRegra(i, { rMax: n }))}
                  </span>
                </label>
                <label className="flex flex-col gap-1">
                  Frequência (mín–máx)
                  <span className="flex items-center gap-1">
                    {notaSelect(r.fMin, (n) => mudarRegra(i, { fMin: n }))}–
                    {notaSelect(r.fMax, (n) => mudarRegra(i, { fMax: n }))}
                  </span>
                </label>
                <label className="flex flex-col gap-1">
                  Valor (mín–máx)
                  <span className="flex items-center gap-1">
                    {notaSelect(r.vMin, (n) => mudarRegra(i, { vMin: n }))}–
                    {notaSelect(r.vMax, (n) => mudarRegra(i, { vMax: n }))}
                  </span>
                </label>
              </div>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={() =>
            setRegras((rs) => [...rs, { nome: "Novo segmento" }])
          }
          className="mt-3 rounded-mi border border-mi-cinza px-3 py-2 text-sm"
        >
          ＋ Adicionar linha
        </button>
      </section>

      {/* Limiares de alerta */}
      <section className="rounded-mi bg-mi-branco p-4 shadow-suave">
        <h2 className="text-lg">Alertas</h2>
        <div className="mt-3 space-y-2 text-sm">
          <label className="flex flex-wrap items-center gap-2">
            Considerar cliente sumida após{" "}
            {numInput(sumida, setSumida)} dias sem atendimento
          </label>
          <label className="flex flex-wrap items-center gap-2">
            Lead fria após {numInput(leadFria, setLeadFria)} dias sem primeiro
            acesso
          </label>
          <label className="flex flex-wrap items-center gap-2">
            Abandono relevante após {numInput(abandono, setAbandono)}{" "}
            tentativa(s) sem agendar
          </label>
          <label className="flex flex-wrap items-center gap-2">
            Noiva parada no funil após {numInput(funilParada, setFunilParada)}{" "}
            dias na mesma etapa
          </label>
          <label className="flex flex-wrap items-center gap-2">
            Guardar a atividade do site por {numInput(retencao, setRetencao)}{" "}
            meses (LGPD)
          </label>
        </div>
      </section>

      {/* Réguas de mensagens (F4) */}
      <section className="rounded-mi bg-mi-branco p-4 shadow-suave">
        <h2 className="text-lg">Mensagens automáticas (réguas)</h2>
        <p className="mt-1 text-sm text-mi-texto/70">
          As réguas só <strong>sugerem</strong> mensagens na sua fila — nada é
          enviado sem você ler, editar e mandar. Aqui você liga cada régua e
          define o ritmo.
        </p>
        <div className="mt-3 space-y-2 text-sm">
          {(
            [
              ["sumida", "Cliente sumida"],
              ["abandono", "Não concluiu o agendamento"],
              ["leadFria", "Boas-vindas (nunca acessou)"],
            ] as const
          ).map(([k, label]) => (
            <label key={k} className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={reguas.ativas[k]}
                onChange={(e) =>
                  setReguas((r) => ({
                    ...r,
                    ativas: { ...r.ativas, [k]: e.target.checked },
                  }))
                }
              />
              {label}
            </label>
          ))}
        </div>
        <div className="mt-4 space-y-2 text-sm">
          <label className="flex flex-wrap items-center gap-2">
            Esperar{" "}
            {numInput(reguas.intervaloPorClienteDias, (v) =>
              setReguas((r) => ({ ...r, intervaloPorClienteDias: v })),
            )}{" "}
            dias entre mensagens para a mesma cliente
          </label>
          <label className="flex flex-wrap items-center gap-2">
            No máximo{" "}
            {numInput(reguas.maxSugestoesPorDia, (v) =>
              setReguas((r) => ({ ...r, maxSugestoesPorDia: v })),
            )}{" "}
            sugestões novas por dia
          </label>
        </div>
        <div className="mt-4 space-y-3">
          {(
            [
              ["sumida", "Mensagem para cliente sumida"],
              ["abandono", "Mensagem para quem não concluiu"],
              ["leadFria", "Mensagem de boas-vindas"],
            ] as const
          ).map(([k, label]) => (
            <label key={k} className="block text-xs">
              {label}{" "}
              <span className="text-mi-texto/50">
                (use {"{nome}"} e {"{dias}"})
              </span>
              <textarea
                value={reguas.templates[k]}
                onChange={(e) =>
                  setReguas((r) => ({
                    ...r,
                    templates: { ...r.templates, [k]: e.target.value },
                  }))
                }
                rows={2}
                className="input-mi mt-1 w-full !py-2"
              />
            </label>
          ))}
        </div>
      </section>

      {/* Prévia */}
      {preview && (
        <section className="rounded-mi bg-mi-bege p-4">
          <h3 className="text-sm font-medium text-mi-marrom-escuro">
            Prévia — como a base ficaria ({preview.base} cliente(s))
          </h3>
          <div className="mt-2 flex flex-wrap gap-2">
            {Object.entries(preview.porSegmento).map(([nome, qtd]) => (
              <span
                key={nome}
                className="rounded-full bg-mi-branco px-3 py-1 text-sm shadow-suave"
              >
                {nome}: <strong>{qtd}</strong>
              </span>
            ))}
            {Object.keys(preview.porSegmento).length === 0 && (
              <span className="text-sm text-mi-texto/60">
                Nenhuma cliente na base ativa ainda.
              </span>
            )}
          </div>
          <p className="mt-2 text-xs text-mi-texto/60">
            Nada foi salvo ainda — é só uma simulação.
          </p>
        </section>
      )}

      {msg && (
        <p
          role="alert"
          className={`rounded-mi px-4 py-3 text-sm ${
            msg.tipo === "ok"
              ? "bg-emerald-50 text-emerald-900"
              : "bg-red-50 text-red-800"
          }`}
        >
          {msg.texto}
        </p>
      )}

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={verPrevia}
          disabled={pending}
          className="rounded-mi border border-mi-marrom px-5 py-2.5 text-sm text-mi-marrom disabled:opacity-60"
        >
          {pending ? "Calculando…" : "Ver prévia"}
        </button>
        <button
          type="button"
          onClick={salvar}
          disabled={pending}
          className="rounded-mi bg-mi-marrom px-6 py-2.5 text-sm text-white disabled:opacity-60"
        >
          Salvar régua
        </button>
        <button
          type="button"
          onClick={recalcular}
          disabled={pending}
          className="ml-auto rounded-mi border border-mi-cinza px-4 py-2.5 text-sm disabled:opacity-60"
        >
          Recalcular agora
        </button>
      </div>
    </div>
  );
}
