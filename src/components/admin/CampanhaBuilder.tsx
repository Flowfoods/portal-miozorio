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
 * Construtor de campanha (F2): público (filtros AND) → mensagem. Mostra a
 * contagem do público e uma amostra de 5 nomes em tempo real antes de salvar.
 */
export default function CampanhaBuilder({
  servicos,
  rfvSegmentos,
}: {
  servicos: { code: string; name: string }[];
  rfvSegmentos: string[];
}) {
  const router = useRouter();
  const [nome, setNome] = useState("");
  const [corpo, setCorpo] = useState(
    "Oi {nome} 💛 Faz um tempinho! Que tal marcar seu horário? {link_agenda}",
  );
  const [inatividade, setInatividade] = useState<number | "">("");
  const [fez, setFez] = useState<string[]>([]);
  const [rfv, setRfv] = useState<string[]>([]);
  const [aniversario, setAniversario] = useState<"" | "mes" | "semana">("");
  const [funil, setFunil] = useState(false);

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
      const r = await criarCampanhaAction(nome, corpo, JSON.parse(cfgKey));
      if (r.ok) router.push(`/admin/campanhas/${r.id}`);
      else setErro(r.message);
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div className="space-y-5">
        <label className="block">
          <span className="mb-1 block text-sm text-mi-texto/70">Nome da campanha</span>
          <input className="input-mi" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Inativas 60d que já fizeram maquiagem" />
        </label>

        <fieldset className="rounded-mi bg-mi-branco p-4 shadow-suave">
          <legend className="px-1 text-sm text-mi-marrom-escuro">Público</legend>
          <label className="mt-2 block text-sm">
            Sem vir há (dias)
            <input type="number" min={0} className="input-mi mt-1 !py-2" value={inatividade}
              onChange={(e) => setInatividade(e.target.value === "" ? "" : Number(e.target.value))}
              placeholder="ex.: 60" />
          </label>

          <p className="mt-3 text-sm text-mi-texto/70">Já fez o serviço</p>
          <div className="mt-1 flex flex-wrap gap-2">
            {servicos.map((s) => (
              <button key={s.code} type="button" onClick={() => toggle(fez, s.code, setFez)}
                className={`rounded-full px-3 py-1 text-xs ${fez.includes(s.code) ? "bg-mi-marrom text-white" : "bg-mi-superficie-nav text-mi-marrom-escuro"}`}>
                {s.name}
              </button>
            ))}
          </div>

          {rfvSegmentos.length > 0 && (
            <>
              <p className="mt-3 text-sm text-mi-texto/70">Segmento (RFV)</p>
              <div className="mt-1 flex flex-wrap gap-2">
                {rfvSegmentos.map((s) => (
                  <button key={s} type="button" onClick={() => toggle(rfv, s, setRfv)}
                    className={`rounded-full px-3 py-1 text-xs ${rfv.includes(s) ? "bg-mi-marrom text-white" : "bg-mi-superficie-nav text-mi-marrom-escuro"}`}>
                    {s}
                  </button>
                ))}
              </div>
            </>
          )}

          <label className="mt-3 block text-sm">
            Aniversariantes
            <select className="input-mi mt-1 !py-2" value={aniversario}
              onChange={(e) => setAniversario(e.target.value as "" | "mes" | "semana")}>
              <option value="">—</option>
              <option value="semana">Da semana</option>
              <option value="mes">Do mês</option>
            </select>
          </label>

          <label className="mt-3 flex items-center gap-2 text-sm">
            <input type="checkbox" checked={funil} onChange={(e) => setFunil(e.target.checked)} />
            Leads de noiva/debutante (CTA sempre WhatsApp)
          </label>
        </fieldset>

        <label className="block">
          <span className="mb-1 block text-sm text-mi-texto/70">Mensagem</span>
          <textarea className="input-mi min-h-28" value={corpo} onChange={(e) => setCorpo(e.target.value)} />
          <span className="mt-1 block text-xs text-mi-texto/55">
            Variáveis: {"{nome}"} {"{servico_ultimo}"} {"{dias_sem_vir}"} {"{pontos_clube}"} {"{link_agenda}"}
          </span>
        </label>

        {erro && <p className="text-sm text-red-700">{erro}</p>}
        <button onClick={salvar} disabled={pending}
          className="rounded-mi bg-mi-marrom px-6 py-3 text-white disabled:opacity-60">
          {pending ? "Salvando…" : "Salvar campanha"}
        </button>
      </div>

      <aside className="h-fit rounded-mi bg-mi-superficie-nav p-4">
        <p className="text-xs uppercase tracking-wide text-mi-texto/55">Público agora</p>
        <p className="font-titulo text-4xl text-mi-marrom-escuro">{preview?.count ?? "…"}</p>
        <p className="mt-1 text-xs text-mi-texto/60">clientes nesse filtro</p>
        <ul className="mt-3 space-y-1 text-sm text-mi-texto/75">
          {preview?.amostra.map((a, i) => (
            <li key={i}>{a.nome} · {a.telefone}</li>
          ))}
          {preview && preview.amostra.length === 0 && <li className="text-mi-texto/50">Ninguém nesse filtro ainda.</li>}
        </ul>
      </aside>
    </div>
  );
}
