"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  enviarMensagemAction,
  descartarMensagemAction,
  gerarSugestoesAction,
} from "./actions";

/**
 * Fila de aprovação (F4) — mobile-first (R19). Cada sugestão vem com o texto
 * proposto num textarea: a Mi SEMPRE pode editar/personalizar antes de enviar.
 */

export interface ItemFila {
  id: string;
  clienteId: string;
  clienteNome: string;
  telefone: string;
  origem: string; // rótulo leigo da régua
  texto: string;
  criadoEm: string; // já formatado
}

export default function FilaMensagens({
  itens,
  whatsappOk,
}: {
  itens: ItemFila[];
  whatsappOk: boolean;
}) {
  const [fila, setFila] = useState(itens);
  const [textos, setTextos] = useState<Record<string, string>>(
    Object.fromEntries(itens.map((i) => [i.id, i.texto])),
  );
  const [msg, setMsg] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(
    null,
  );
  const [pending, startTransition] = useTransition();

  function enviar(id: string) {
    setMsg(null);
    startTransition(async () => {
      const r = await enviarMensagemAction(id, textos[id] ?? "");
      if (r.ok) {
        setFila((f) => f.filter((i) => i.id !== id));
        setMsg({ tipo: "ok", texto: "Enviada 💛" });
      } else setMsg({ tipo: "erro", texto: r.message });
    });
  }

  function descartar(id: string) {
    setMsg(null);
    startTransition(async () => {
      const r = await descartarMensagemAction(id);
      if (r.ok) setFila((f) => f.filter((i) => i.id !== id));
      else setMsg({ tipo: "erro", texto: r.message });
    });
  }

  function buscar() {
    setMsg(null);
    startTransition(async () => {
      const r = await gerarSugestoesAction();
      if (r.ok) {
        setMsg({
          tipo: "ok",
          texto:
            r.criadas > 0
              ? `${r.criadas} sugestão(ões) nova(s) — recarregue a página.`
              : "Nenhuma sugestão nova por agora.",
        });
      } else setMsg({ tipo: "erro", texto: r.message });
    });
  }

  return (
    <div className="space-y-4">
      {!whatsappOk && (
        <p className="rounded-mi bg-amber-50 px-4 py-3 text-sm text-amber-900">
          O WhatsApp ainda não está configurado no servidor — dá para revisar e
          descartar sugestões, mas não enviar.
        </p>
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

      {fila.length === 0 && (
        <div className="rounded-mi bg-mi-branco p-6 text-center shadow-suave">
          <p className="text-sm text-mi-texto/60">
            Nenhuma mensagem esperando você 💛
          </p>
          <button
            onClick={buscar}
            disabled={pending}
            className="mt-3 rounded-mi border border-mi-cinza px-4 py-2 text-sm disabled:opacity-60"
          >
            {pending ? "Buscando…" : "Buscar sugestões agora"}
          </button>
        </div>
      )}

      {fila.map((i) => (
        <div key={i.id} className="rounded-mi bg-mi-branco p-4 shadow-suave">
          <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
            <p className="font-medium">
              <Link
                href={`/admin/clientes/${i.clienteId}`}
                className="text-mi-marrom-escuro underline underline-offset-4"
              >
                {i.clienteNome}
              </Link>{" "}
              <span className="text-sm font-normal text-mi-texto/60">
                · {i.telefone}
              </span>
            </p>
            <span className="rounded-full bg-mi-bege px-3 py-1 text-xs text-mi-marrom-escuro">
              {i.origem}
            </span>
          </div>
          <textarea
            value={textos[i.id] ?? ""}
            onChange={(e) =>
              setTextos((t) => ({ ...t, [i.id]: e.target.value }))
            }
            rows={3}
            className="input-mi w-full !py-2 text-sm"
            aria-label={`Mensagem para ${i.clienteNome}`}
          />
          <div className="mt-2 flex items-center gap-2">
            <button
              onClick={() => enviar(i.id)}
              disabled={pending || !whatsappOk}
              className="rounded-mi bg-mi-marrom px-4 py-2 text-sm text-white disabled:opacity-60"
            >
              Enviar
            </button>
            <button
              onClick={() => descartar(i.id)}
              disabled={pending}
              className="rounded-mi border border-mi-cinza px-4 py-2 text-sm disabled:opacity-60"
            >
              Descartar
            </button>
            <span className="ml-auto text-xs text-mi-texto/50">
              sugerida em {i.criadoEm}
            </span>
          </div>
        </div>
      ))}

      {fila.length > 0 && (
        <button
          onClick={buscar}
          disabled={pending}
          className="rounded-mi border border-mi-cinza px-4 py-2 text-sm disabled:opacity-60"
        >
          {pending ? "Buscando…" : "Buscar sugestões agora"}
        </button>
      )}
    </div>
  );
}
