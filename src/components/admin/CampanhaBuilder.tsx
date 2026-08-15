"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  previewSegmentoAction,
  criarCampanhaAction,
  type PreviewResult,
} from "@/app/admin/campanhas/actions";
import type { SegmentoConfig } from "@/lib/campanhas/segmento";

/**
 * Wizard de campanha em 3 passos (F3): Público → Mensagem → Quando. Linguagem
 * leiga, mobile-first (a Mi opera pelo celular). Passo 1 mostra contagem em
 * tempo real + amostra de 5 nomes; passo 2 tem os textos prontos da biblioteca.
 */

interface TemplatePronto {
  id: string;
  nome: string;
  corpo: string;
}

const PASSOS = ["Público", "Mensagem", "Quando"] as const;

export default function CampanhaBuilder({
  servicos,
  rfvSegmentos,
  templates,
}: {
  servicos: { code: string; name: string }[];
  rfvSegmentos: string[];
  templates: TemplatePronto[];
}) {
  const router = useRouter();
  const [passo, setPasso] = useState(0);

  // Passo 1 — público
  const [inatividade, setInatividade] = useState<number | "">("");
  const [fez, setFez] = useState<string[]>([]);
  const [rfv, setRfv] = useState<string[]>([]);
  const [aniversario, setAniversario] = useState<"" | "mes" | "semana">("");
  const [funil, setFunil] = useState(false);

  // Passo 2 — mensagem
  const [nome, setNome] = useState("");
  const [corpo, setCorpo] = useState("");

  // Passo 3 — quando
  const [quando, setQuando] = useState<"manual" | "agendar">("manual");
  const [dataHora, setDataHora] = useState("");

  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const cfg: SegmentoConfig = {
    ...(inatividade !== "" ? { inatividadeDias: Number(inatividade) } : {}),
    ...(fez.length ? { fezServico: fez } : {}),
    ...(rfv.length ? { rfvSegmentos: rfv } : {}),
    ...(aniversario ? { aniversario } : {}),
    ...(funil ? { funilLeads: true } : {}),
  };
  const cfgKey = JSON.stringify(cfg);

  useEffect(() => {
    let vivo = true;
    const t = setTimeout(() => {
      previewSegmentoAction(JSON.parse(cfgKey)).then((r) => vivo && setPreview(r));
    }, 400);
    return () => {
      vivo = false;
      clearTimeout(t);
    };
  }, [cfgKey]);

  const toggle = (arr: string[], v: string, set: (x: string[]) => void) =>
    set(arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

  function salvar() {
    setErro(null);
    start(async () => {
      const r = await criarCampanhaAction(
        nome,
        corpo,
        JSON.parse(cfgKey),
        quando === "agendar" && dataHora ? new Date(dataHora).toISOString() : null,
      );
      if (r.ok) router.push(`/admin/campanhas/${r.id}`);
      else setErro(r.message);
    });
  }

  return (
    <div className="mx-auto max-w-xl">
      {/* Trilha dos passos */}
      <ol className="mb-6 flex items-center gap-2">
        {PASSOS.map((p, i) => (
          <li key={p} className="flex flex-1 items-center gap-2">
            <button
              type="button"
              onClick={() => i < passo && setPasso(i)}
              className={`flex h-11 flex-1 items-center justify-center gap-2 rounded-mi text-sm transition-colors ${
                i === passo
                  ? "bg-mi-marrom text-white"
                  : i < passo
                    ? "bg-mi-superficie-nav text-mi-marrom-escuro"
                    : "bg-mi-branco text-mi-texto/40 shadow-suave"
              }`}
            >
              <span className="font-titulo">{i + 1}</span> {p}
            </button>
          </li>
        ))}
      </ol>

      {passo === 0 && (
        <div className="space-y-4">
          <div className="rounded-mi bg-mi-superficie-nav p-4 text-center">
            <p className="text-xs uppercase tracking-wide text-mi-texto/80">
              Quem vai receber
            </p>
            <p className="font-titulo text-4xl text-mi-marrom-escuro">
              {preview?.count ?? "…"}
            </p>
            <p className="text-xs text-mi-texto/80">
              {preview?.amostra.length
                ? `ex.: ${preview.amostra.map((a) => a.nome.split(" ")[0]).join(", ")}`
                : "clientes nesse filtro"}
            </p>
          </div>

          <label className="block rounded-mi bg-mi-branco p-4 shadow-suave text-sm">
            Está sem vir há pelo menos (dias)
            <div className="mt-2 flex gap-2">
              {[30, 45, 60, 90].map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setInatividade(inatividade === d ? "" : d)}
                  className={`h-11 flex-1 rounded-mi text-sm ${
                    inatividade === d
                      ? "bg-mi-marrom text-white"
                      : "bg-mi-superficie-nav text-mi-marrom-escuro"
                  }`}
                >
                  {d}
                </button>
              ))}
              <input
                type="number"
                min={1}
                placeholder="outro"
                className="input-mi !w-24 !py-2"
                value={typeof inatividade === "number" && ![30, 45, 60, 90].includes(inatividade) ? inatividade : ""}
                onChange={(e) =>
                  setInatividade(e.target.value === "" ? "" : Number(e.target.value))
                }
              />
            </div>
          </label>

          <div className="rounded-mi bg-mi-branco p-4 shadow-suave">
            <p className="text-sm text-mi-texto/80">Já fez o serviço</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {servicos.map((s) => (
                <button
                  key={s.code}
                  type="button"
                  onClick={() => toggle(fez, s.code, setFez)}
                  className={`min-h-11 rounded-full px-3 py-2 text-xs ${
                    fez.includes(s.code)
                      ? "bg-mi-marrom text-white"
                      : "bg-mi-superficie-nav text-mi-marrom-escuro"
                  }`}
                >
                  {s.name}
                </button>
              ))}
            </div>
          </div>

          {rfvSegmentos.length > 0 && (
            <div className="rounded-mi bg-mi-branco p-4 shadow-suave">
              <p className="text-sm text-mi-texto/80">Grupo de clientes</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {rfvSegmentos.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => toggle(rfv, s, setRfv)}
                    className={`min-h-11 rounded-full px-3 py-2 text-xs ${
                      rfv.includes(s)
                        ? "bg-mi-marrom text-white"
                        : "bg-mi-superficie-nav text-mi-marrom-escuro"
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="rounded-mi bg-mi-branco p-4 shadow-suave space-y-3 text-sm">
            <label className="block">
              Aniversariantes
              <select
                className="input-mi mt-1 !py-2"
                value={aniversario}
                onChange={(e) => setAniversario(e.target.value as "" | "mes" | "semana")}
              >
                <option value="">Não filtrar</option>
                <option value="semana">Da semana</option>
                <option value="mes">Do mês</option>
              </select>
            </label>
            <label className="flex min-h-11 items-center gap-2">
              <input
                type="checkbox"
                checked={funil}
                onChange={(e) => setFunil(e.target.checked)}
              />
              Noivas/debutantes em conversa (recebem convite pro WhatsApp da Mi)
            </label>
          </div>

          <button
            onClick={() => setPasso(1)}
            className="h-12 w-full rounded-mi bg-mi-marrom text-white"
          >
            Continuar → Mensagem
          </button>
        </div>
      )}

      {passo === 1 && (
        <div className="space-y-4">
          <label className="block">
            <span className="mb-1 block text-sm text-mi-texto/80">Nome da campanha</span>
            <input
              className="input-mi"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex.: Inativas 60 dias — maquiagem"
            />
          </label>

          {templates.length > 0 && (
            <div className="rounded-mi bg-mi-branco p-4 shadow-suave">
              <p className="text-sm text-mi-texto/80">Comece por um texto pronto</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {templates.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setCorpo(t.corpo)}
                    className="min-h-11 rounded-full bg-mi-superficie-nav px-3 py-2 text-xs text-mi-marrom-escuro"
                  >
                    {t.nome}
                  </button>
                ))}
              </div>
            </div>
          )}

          <label className="block">
            <span className="mb-1 block text-sm text-mi-texto/80">Mensagem</span>
            <textarea
              className="input-mi min-h-32"
              value={corpo}
              onChange={(e) => setCorpo(e.target.value)}
              placeholder="Escreva com o seu carinho de sempre 💛"
            />
            <span className="mt-1 block text-xs text-mi-texto/80">
              Pode usar: {"{nome}"} {"{servico_ultimo}"} {"{dias_sem_vir}"}{" "}
              {"{pontos_clube}"} {"{link_agenda}"}
            </span>
          </label>

          <div className="flex gap-2">
            <button
              onClick={() => setPasso(0)}
              className="h-12 flex-1 rounded-mi border border-mi-marrom text-mi-marrom"
            >
              ← Público
            </button>
            <button
              onClick={() => setPasso(2)}
              disabled={corpo.trim().length < 5 || nome.trim().length < 2}
              className="h-12 flex-1 rounded-mi bg-mi-marrom text-white disabled:opacity-50"
            >
              Continuar → Quando
            </button>
          </div>
        </div>
      )}

      {passo === 2 && (
        <div className="space-y-4">
          <div className="rounded-mi bg-mi-branco p-4 shadow-suave text-sm">
            <p className="text-mi-texto/80">Resumo</p>
            <p className="mt-1 font-corpo text-mi-marrom-escuro">{nome}</p>
            <p className="mt-1 text-mi-texto/80">
              Para <strong>{preview?.count ?? "…"}</strong> cliente(s)
            </p>
            <p className="mt-2 whitespace-pre-wrap rounded-mi bg-mi-superficie p-3 text-mi-texto">
              {corpo}
            </p>
          </div>

          <div className="rounded-mi bg-mi-branco p-4 shadow-suave space-y-3 text-sm">
            <label className="flex min-h-11 items-center gap-2">
              <input
                type="radio"
                checked={quando === "manual"}
                onChange={() => setQuando("manual")}
              />
              Deixar pronta — eu disparo quando quiser (dá pra testar antes)
            </label>
            <label className="flex min-h-11 items-center gap-2">
              <input
                type="radio"
                checked={quando === "agendar"}
                onChange={() => setQuando("agendar")}
              />
              Agendar o envio
            </label>
            {quando === "agendar" && (
              <input
                type="datetime-local"
                className="input-mi"
                value={dataHora}
                onChange={(e) => setDataHora(e.target.value)}
              />
            )}
          </div>

          {erro && <p className="text-sm text-red-700">{erro}</p>}
          <div className="flex gap-2">
            <button
              onClick={() => setPasso(1)}
              className="h-12 flex-1 rounded-mi border border-mi-marrom text-mi-marrom"
            >
              ← Mensagem
            </button>
            <button
              onClick={salvar}
              disabled={pending || (quando === "agendar" && !dataHora)}
              className="h-12 flex-1 rounded-mi bg-mi-marrom text-white disabled:opacity-50"
            >
              {pending ? "Salvando…" : "Salvar campanha 💛"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
