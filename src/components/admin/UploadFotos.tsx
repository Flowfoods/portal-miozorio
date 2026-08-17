"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CLIENT_JPEG_QUALITY,
  CLIENT_MAX_DIM,
  CLIENT_SKIP_BYTES,
  MAX_UPLOAD_BYTES,
  MEDIA_CATEGORIES,
  MEDIA_CATEGORY_LABEL,
  UPLOAD_ACCEPT,
  formatMB,
} from "@/lib/media-shared";

/**
 * Upload de fotos do painel (BUG D — F4). O que muda em relação ao form
 * antigo (server action):
 *  - cada foto vai numa request própria → o lote do Instagram inteiro não
 *    estoura mais o body; uma foto ruim não derruba as outras;
 *  - pré-redimensionamento NO NAVEGADOR (≤4000px, q0.92): export de fotógrafo
 *    de 30MB vira ~4–6MB antes de trafegar — em 4G é a diferença entre subir
 *    em segundos e morrer no meio;
 *  - barra de progresso real por arquivo + retry automático (1×) + cancelar.
 * A mensagem-resumo continua a MESMA da tela (enviadas/pulados via URL).
 */

type ItemStatus =
  | "aguardando"
  | "otimizando"
  | "enviando"
  | "ok"
  | "erro"
  | "cancelado";

type Item = {
  file: File;
  preview: string | null;
  status: ItemStatus;
  pct: number;
  erro?: string;
};

/** Reduz no navegador quando vale a pena. Falhou/HEIC → arquivo original. */
async function otimizar(file: File): Promise<File> {
  if (file.size <= CLIENT_SKIP_BYTES) return file;
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return file; // HEIC → servidor
  try {
    const bitmap = await createImageBitmap(file, {
      imageOrientation: "from-image",
    });
    const escala = Math.min(
      1,
      CLIENT_MAX_DIM / Math.max(bitmap.width, bitmap.height),
    );
    const w = Math.round(bitmap.width * escala);
    const h = Math.round(bitmap.height * escala);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close();
    const blob = await new Promise<Blob | null>((res) =>
      canvas.toBlob(res, "image/jpeg", CLIENT_JPEG_QUALITY),
    );
    if (!blob || blob.size >= file.size) return file; // só se ficou menor
    return new File([blob], file.name.replace(/\.\w+$/, "") + ".jpg", {
      type: "image/jpeg",
    });
  } catch {
    return file;
  }
}

function enviarXHR(
  url: string,
  form: FormData,
  onPct: (pct: number) => void,
  registrar: (xhr: XMLHttpRequest) => void,
): Promise<{ ok: boolean; status: number; error?: string }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    registrar(xhr);
    xhr.open("POST", url);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onPct(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      let error: string | undefined;
      try {
        error = JSON.parse(xhr.responseText)?.error;
      } catch {
        /* corpo não-JSON (ex.: proxy) — cai na mensagem padrão */
      }
      resolve({ ok: xhr.status >= 200 && xhr.status < 300, status: xhr.status, error });
    };
    xhr.onerror = () => reject(new Error("rede"));
    xhr.onabort = () => resolve({ ok: false, status: 0, error: "cancelado" });
    xhr.send(form);
  });
}

export default function UploadFotos() {
  const router = useRouter();
  const [itens, setItens] = useState<Item[]>([]);
  const [categoria, setCategoria] = useState<string>(MEDIA_CATEGORIES[0]);
  const [alt, setAlt] = useState("");
  const [rodando, setRodando] = useState(false);
  const xhrAtual = useRef<XMLHttpRequest | null>(null);
  const canceladoRef = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Não deixar a Mi fechar a aba sem querer no meio do envio.
  useEffect(() => {
    if (!rodando) return;
    const avisar = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", avisar);
    return () => window.removeEventListener("beforeunload", avisar);
  }, [rodando]);

  function escolher(files: FileList | null) {
    if (!files?.length) return;
    setItens(
      Array.from(files).map((file) => ({
        file,
        preview: /^image\/(jpeg|png|webp)$/.test(file.type)
          ? URL.createObjectURL(file)
          : null,
        status:
          file.size > MAX_UPLOAD_BYTES ? ("erro" as const) : ("aguardando" as const),
        pct: 0,
        erro:
          file.size > MAX_UPLOAD_BYTES
            ? `tem ${formatMB(file.size)} — o limite é ${formatMB(MAX_UPLOAD_BYTES)}`
            : undefined,
      })),
    );
  }

  function atualizar(i: number, patch: Partial<Item>) {
    setItens((prev) =>
      prev.map((item, idx) => (idx === i ? { ...item, ...patch } : item)),
    );
  }

  async function enviarUm(i: number, item: Item): Promise<ItemStatus> {
    atualizar(i, { status: "otimizando", pct: 0, erro: undefined });
    const pronto = await otimizar(item.file);
    if (canceladoRef.current) return "cancelado";

    const form = new FormData();
    form.set("category", categoria);
    form.set("alt", alt);
    form.set("file", pronto, pronto.name);

    atualizar(i, { status: "enviando" });
    for (let tentativa = 0; tentativa < 2; tentativa++) {
      if (canceladoRef.current) return "cancelado";
      try {
        const r = await enviarXHR(
          "/api/admin/media",
          form,
          (pct) => atualizar(i, { pct }),
          (xhr) => (xhrAtual.current = xhr),
        );
        if (r.ok) return "ok";
        if (r.error === "cancelado") return "cancelado";
        // Erro do servidor: repetir não muda nada — mostra o motivo real.
        atualizar(i, { erro: r.error ?? "erro ao enviar — tente de novo" });
        return "erro";
      } catch {
        // Queda de rede (4G instável): uma nova tentativa automática.
        if (tentativa === 0) atualizar(i, { pct: 0 });
        else {
          atualizar(i, { erro: "a conexão caiu — toque em tentar de novo" });
          return "erro";
        }
      }
    }
    return "erro";
  }

  async function enviarTudo(indices?: number[]) {
    canceladoRef.current = false;
    setRodando(true);
    const fila =
      indices ??
      itens.map((it, i) => (it.status === "aguardando" ? i : -1)).filter((i) => i >= 0);
    let ok = 0;
    const falhas: string[] = [];
    for (const i of fila) {
      if (canceladoRef.current) break;
      const item = itens[i];
      if (!item) continue;
      const st = await enviarUm(i, item);
      atualizar(i, { status: st, pct: st === "ok" ? 100 : 0 });
      if (st === "ok") ok++;
      else if (st === "erro") falhas.push(item.file.name);
    }
    // Fotos grandes demais escolhidas no seletor também contam como puladas.
    for (const it of itens)
      if (it.status === "erro" && it.erro?.includes("limite"))
        if (!falhas.includes(it.file.name)) falhas.push(it.file.name);
    setRodando(false);
    if (ok > 0 || falhas.length > 0) {
      const params = new URLSearchParams({ enviadas: String(ok) });
      if (falhas.length) {
        params.set("pulados", String(falhas.length));
        params.set("quais", falhas.slice(0, 3).join(" · ").slice(0, 300));
      }
      if (ok > 0 && falhas.length === 0) {
        setItens([]);
        if (inputRef.current) inputRef.current.value = "";
      }
      router.replace(`/admin/fotos?${params.toString()}`);
      router.refresh();
    }
  }

  function cancelar() {
    canceladoRef.current = true;
    xhrAtual.current?.abort();
  }

  const aguardando = itens.filter((i) => i.status === "aguardando").length;
  const comErro = itens
    .map((it, i) => ({ it, i }))
    .filter(({ it }) => it.status === "erro" && !it.erro?.includes("limite"));

  return (
    <div className="mt-6 space-y-3 rounded-mi bg-mi-branco p-4 shadow-suave">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="text-mi-texto">Onde a foto vai aparecer</span>
          <select
            value={categoria}
            onChange={(e) => setCategoria(e.target.value)}
            disabled={rodando}
            className="input-mi mt-1 w-full"
          >
            {MEDIA_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {MEDIA_CATEGORY_LABEL[c]}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="text-mi-texto">
            Descrição (opcional — ajuda o Google)
          </span>
          <input
            value={alt}
            onChange={(e) => setAlt(e.target.value)}
            disabled={rodando}
            placeholder="Ex.: Maquiagem de madrinha pele negra"
            className="input-mi mt-1 w-full"
          />
        </label>
      </div>

      <label className="block text-sm">
        <span className="text-mi-texto">Fotos (pode escolher várias)</span>
        <input
          ref={inputRef}
          type="file"
          accept={UPLOAD_ACCEPT}
          multiple
          disabled={rodando}
          onChange={(e) => escolher(e.target.files)}
          className="mt-1 block w-full text-sm text-mi-texto file:mr-3 file:rounded-mi file:border-0 file:bg-mi-cinza file:px-4 file:py-2.5 file:font-corpo file:text-sm file:text-mi-marrom-escuro"
        />
      </label>

      {itens.length > 0 && (
        <ul className="space-y-2">
          {itens.map((item, i) => (
            <li
              key={`${item.file.name}-${i}`}
              className="flex min-h-[44px] items-center gap-3 rounded-mi bg-mi-bege/60 px-3 py-2"
            >
              {item.preview ? (
                // eslint-disable-next-line @next/next/no-img-element -- preview local (blob:), não passa pelo otimizador
                <img
                  src={item.preview}
                  alt=""
                  className="h-10 w-10 shrink-0 rounded-[8px] object-cover"
                />
              ) : (
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[8px] bg-mi-cinza font-corpo text-[10px] text-mi-marrom-escuro">
                  foto
                </span>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate font-corpo text-sm text-mi-texto">
                  {item.file.name}{" "}
                  <span className="text-mi-texto/60">
                    · {formatMB(item.file.size)}
                  </span>
                </p>
                {item.status === "enviando" && (
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-mi-cinza">
                    <div
                      className="h-full rounded-full bg-mi-marrom transition-[width] duration-200"
                      style={{ width: `${item.pct}%` }}
                    />
                  </div>
                )}
                {item.status === "otimizando" && (
                  <p className="text-xs text-mi-texto/70">Otimizando foto…</p>
                )}
                {item.status === "erro" && (
                  <p className="text-xs text-amber-900">{item.erro}</p>
                )}
              </div>
              <span className="shrink-0 font-corpo text-xs text-mi-texto/80">
                {item.status === "ok" && "✓ no site"}
                {item.status === "enviando" && `${item.pct}%`}
                {item.status === "cancelado" && "cancelado"}
                {item.status === "erro" &&
                  !item.erro?.includes("limite") && (
                    <button
                      type="button"
                      onClick={() => enviarTudo([i])}
                      disabled={rodando}
                      className="min-h-[44px] px-2 text-mi-marrom-escuro underline underline-offset-2"
                    >
                      tentar de novo
                    </button>
                  )}
              </span>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => enviarTudo()}
          disabled={rodando || aguardando === 0}
          className="min-h-[48px] w-full rounded-mi bg-mi-marrom-escuro px-6 text-sm text-white hover:bg-mi-marrom disabled:opacity-60 sm:w-auto"
        >
          {rodando
            ? "Enviando… 💛"
            : aguardando > 1
              ? `Enviar ${aguardando} fotos`
              : "Enviar fotos"}
        </button>
        {rodando && (
          <button
            type="button"
            onClick={cancelar}
            className="min-h-[48px] px-3 text-sm text-mi-marrom-escuro underline underline-offset-4"
          >
            Cancelar
          </button>
        )}
        {!rodando && comErro.length > 0 && (
          <button
            type="button"
            onClick={() => enviarTudo(comErro.map(({ i }) => i))}
            className="min-h-[48px] px-3 text-sm text-mi-marrom-escuro underline underline-offset-4"
          >
            Tentar de novo as que falharam
          </button>
        )}
      </div>
    </div>
  );
}
