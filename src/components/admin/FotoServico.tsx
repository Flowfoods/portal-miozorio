"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { MAX_UPLOAD_BYTES, formatMB } from "@/lib/media-shared";

/**
 * A2 — foto de exemplo do serviço, direto no card (o "cardápio").
 *
 * Sobe pela rota `/api/admin/media` que já existe (uma request por arquivo,
 * progresso real, original preservado, WebP + blur), passando `serviceId` para
 * já vincular — senão a Mi teria que subir em Fotos e depois voltar aqui para
 * amarrar, que é exatamente o tipo de vai-e-volta que ela não faz.
 */
export default function FotoServico({
  serviceId,
  nome,
  foto,
}: {
  serviceId: string;
  nome: string;
  foto: { url: string; alt: string; blurData: string | null } | null;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function enviar(file: File) {
    if (file.size > MAX_UPLOAD_BYTES) {
      setErro(
        `Essa foto tem ${formatMB(file.size)} — o limite é ${formatMB(MAX_UPLOAD_BYTES)}.`,
      );
      return;
    }
    setEnviando(true);
    setErro(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("category", "servico");
      fd.append("serviceId", serviceId);
      fd.append("alt", `${nome} por Mi Ozorio`);
      const res = await fetch("/api/admin/media", { method: "POST", body: fd });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
      };
      if (!res.ok || !data.ok) {
        setErro(data.error ?? "Não consegui enviar a foto. Tenta de novo?");
        return;
      }
      router.refresh();
    } catch {
      setErro("Tivemos um probleminha de conexão. Tenta de novo?");
    } finally {
      setEnviando(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function remover() {
    setEnviando(true);
    setErro(null);
    try {
      const res = await fetch(`/api/admin/media?serviceId=${serviceId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        setErro("Não consegui tirar a foto. Tenta de novo?");
        return;
      }
      router.refresh();
    } catch {
      setErro("Tivemos um probleminha de conexão. Tenta de novo?");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="mt-3 border-t border-mi-cinza/60 pt-3">
      <span className="block text-xs font-medium text-mi-marrom-escuro">
        Foto de exemplo
      </span>
      <p className="mt-0.5 text-xs text-mi-texto/80">
        Aparece para a cliente na hora de escolher o atendimento.
      </p>

      <div className="mt-2 flex items-center gap-3">
        <div className="relative h-20 w-16 shrink-0 overflow-hidden rounded-mi bg-mi-bege ring-1 ring-inset ring-mi-cinza">
          {foto ? (
            <Image
              src={foto.url}
              alt={foto.alt}
              fill
              sizes="64px"
              className="object-cover"
              {...(foto.blurData
                ? { placeholder: "blur" as const, blurDataURL: foto.blurData }
                : {})}
            />
          ) : (
            <span
              aria-hidden
              className="flex h-full w-full items-center justify-center font-titulo text-2xl italic text-mi-marrom-400"
            >
              Mi
            </span>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={enviando}
            onClick={() => inputRef.current?.click()}
            className="min-h-[44px] rounded-mi border border-mi-cinza px-3 py-2 text-sm text-mi-marrom-escuro disabled:opacity-60"
          >
            {enviando ? "Enviando…" : foto ? "Trocar foto" : "Escolher foto"}
          </button>
          {foto && (
            <button
              type="button"
              disabled={enviando}
              onClick={remover}
              className="min-h-[44px] px-2 text-sm text-mi-erro-tinta underline-offset-2 hover:underline disabled:opacity-60"
            >
              Tirar
            </button>
          )}
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void enviar(f);
        }}
      />

      {erro && (
        <p role="alert" className="mt-2 text-xs text-mi-erro-tinta">
          {erro}
        </p>
      )}
    </div>
  );
}
