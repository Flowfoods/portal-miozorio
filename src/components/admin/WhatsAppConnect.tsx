"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Conexão do WhatsApp (Evolution) — mostra o QR para a Mi parear o celular e
 * fica de olho no estado. Busca tudo de `/api/admin/whatsapp/status` (segredo
 * no servidor). Enquanto desconectado, atualiza o QR a cada 5s (ele expira);
 * ao conectar, para de pedir e mostra o sucesso.
 */

interface Status {
  configured: boolean;
  state: "open" | "connecting" | "close" | null;
  qrBase64: string | null;
  pairingCode: string | null;
  instance: string | null;
}

const POLL_MS = 5000;

export default function WhatsAppConnect({ inicial }: { inicial: Status }) {
  const [st, setSt] = useState<Status>(inicial);
  const [erro, setErro] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const buscar = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/whatsapp/status", {
        cache: "no-store",
      });
      if (!res.ok) throw new Error();
      setSt(await res.json());
      setErro(false);
    } catch {
      setErro(true);
    }
  }, []);

  // Poll só enquanto não estiver conectado.
  useEffect(() => {
    if (!st.configured || st.state === "open") return;
    timer.current = setTimeout(buscar, POLL_MS);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [st, buscar]);

  if (!st.configured) {
    return (
      <div className="rounded-mi bg-amber-50 p-4 text-sm text-amber-900 ring-1 ring-amber-200">
        O WhatsApp ainda não está configurado no servidor (faltam as variáveis
        <code className="mx-1">EVOLUTION_API_URL/KEY/INSTANCE</code>). Assim que
        elas estiverem no ambiente, o QR aparece aqui.
      </div>
    );
  }

  if (st.state === "open") {
    return (
      <div className="rounded-mi bg-emerald-50 p-5 text-center ring-1 ring-emerald-200">
        <p className="font-titulo text-xl text-emerald-800">WhatsApp conectado ✅</p>
        <p className="mt-1 text-sm text-emerald-900/80">
          Os lembretes, confirmações e códigos de recuperação já saem por aqui.
        </p>
        <button
          onClick={buscar}
          className="mt-4 rounded-mi border border-emerald-300 px-4 py-2 text-sm text-emerald-800 transition-colors hover:bg-emerald-100"
        >
          Verificar de novo
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-mi bg-mi-branco p-5 text-center shadow-suave">
      <ol className="mx-auto mb-4 max-w-sm list-decimal space-y-1 pl-5 text-left text-sm text-mi-texto/75">
        <li>Abra o WhatsApp no celular da Mi.</li>
        <li>
          Toque em <strong>Aparelhos conectados → Conectar aparelho</strong>.
        </li>
        <li>Aponte a câmera para o código abaixo.</li>
      </ol>

      {st.qrBase64 ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={st.qrBase64}
          alt="QR code para conectar o WhatsApp"
          width={264}
          height={264}
          className="mx-auto rounded-mi border border-mi-cinza bg-white p-2"
        />
      ) : (
        <div className="mx-auto flex h-[264px] w-[264px] items-center justify-center rounded-mi border border-dashed border-mi-cinza text-sm text-mi-texto/80">
          {erro ? "O WhatsApp não respondeu agora." : "Gerando o QR…"}
        </div>
      )}

      {st.pairingCode && (
        <p className="mt-3 text-sm text-mi-texto/80">
          Ou use o código de pareamento:{" "}
          <strong className="tracking-widest">{st.pairingCode}</strong>
        </p>
      )}

      <p className="mt-3 text-xs text-mi-texto/80">
        O código atualiza sozinho a cada poucos segundos.
      </p>
      <button
        onClick={buscar}
        className="mt-3 rounded-mi border border-mi-marrom px-4 py-2 text-sm text-mi-marrom-escuro transition-colors hover:bg-mi-marrom-escuro hover:text-white"
      >
        Atualizar agora
      </button>
    </div>
  );
}
