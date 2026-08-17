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

  // Pareamento por número (o caminho de quem está no celular).
  const [numero, setNumero] = useState("");
  const [codigo, setCodigo] = useState<string | null>(null);
  const [pedindo, setPedindo] = useState(false);
  const [erroPair, setErroPair] = useState<string | null>(null);
  const [resetando, setResetando] = useState(false);

  async function pedirCodigo() {
    setPedindo(true);
    setErroPair(null);
    try {
      const res = await fetch("/api/admin/whatsapp/pair", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ numero }),
      });
      const j = (await res.json()) as { code?: string; error?: string };
      if (!res.ok || !j.code) {
        setErroPair(j.error ?? "Não consegui gerar o código agora.");
        return;
      }
      setCodigo(j.code);
    } catch {
      setErroPair("Não consegui gerar o código agora.");
    } finally {
      setPedindo(false);
    }
  }

  async function recomecar() {
    setResetando(true);
    setErroPair(null);
    setCodigo(null);
    try {
      const res = await fetch("/api/admin/whatsapp/reset", { method: "POST" });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        setErroPair(j.error ?? "Não consegui encerrar a sessão agora.");
        return;
      }
      await buscar();
    } catch {
      setErroPair("Não consegui encerrar a sessão agora.");
    } finally {
      setResetando(false);
    }
  }

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
      <div className="rounded-mi bg-mi-alerta/10 p-4 text-sm text-mi-alerta-tinta ring-1 ring-mi-alerta/40">
        O WhatsApp ainda não está configurado no servidor (faltam as variáveis
        <code className="mx-1">EVOLUTION_API_URL/KEY/INSTANCE</code>). Assim que
        elas estiverem no ambiente, o QR aparece aqui.
      </div>
    );
  }

  if (st.state === "open") {
    return (
      <div className="rounded-mi bg-mi-sucesso/10 p-5 text-center ring-1 ring-mi-sucesso/40">
        <p className="font-titulo text-xl text-mi-sucesso-tinta">WhatsApp conectado ✅</p>
        <p className="mt-1 text-sm text-mi-sucesso-tinta">
          Os lembretes, confirmações e códigos de recuperação já saem por aqui.
        </p>
        <button
          onClick={buscar}
          className="mt-4 rounded-mi border border-mi-sucesso/40 px-4 py-2 text-sm text-mi-sucesso-tinta transition-colors hover:bg-mi-sucesso/10"
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

      <p className="mt-3 text-xs text-mi-texto/80">
        O código atualiza sozinho a cada poucos segundos.
      </p>
      <button
        onClick={buscar}
        className="mt-3 min-h-[44px] rounded-mi border border-mi-marrom px-4 py-2 text-sm text-mi-marrom-escuro transition-colors hover:bg-mi-marrom-escuro hover:text-white"
      >
        Atualizar agora
      </button>

      {/* Caminho do celular: ler o QR exige um SEGUNDO aparelho, e a Mi opera
          pelo telefone. Com o código de 8 dígitos ela conecta sozinha. */}
      <div className="mt-6 border-t border-mi-cinza pt-5 text-left">
        <p className="font-titulo text-lg text-mi-marrom-escuro">
          Está no celular e não consegue ler o código?
        </p>
        <p className="mt-1 text-sm text-mi-texto/80">
          Dá para conectar digitando um código no lugar de apontar a câmera.
        </p>

        {codigo ? (
          <div className="mt-3 rounded-mi bg-mi-bege p-4">
            <p className="text-sm text-mi-texto/80">No WhatsApp, toque em</p>
            <p className="text-sm text-mi-marrom-escuro">
              <strong>Aparelhos conectados → Conectar aparelho →</strong>{" "}
              <strong>Conectar com número de telefone</strong>, e digite:
            </p>
            <p className="mt-3 text-center font-titulo text-3xl tracking-[0.25em] text-mi-marrom-escuro">
              {codigo}
            </p>
            <p className="mt-2 text-center text-xs text-mi-texto/80">
              O código vale por alguns minutos. Se expirar, peça outro.
            </p>
          </div>
        ) : (
          <div className="mt-3 flex flex-wrap items-end gap-2">
            <label className="flex-1 text-sm">
              <span className="text-mi-texto">
                Seu WhatsApp (com DDD)
              </span>
              <input
                value={numero}
                onChange={(e) => setNumero(e.target.value)}
                type="tel"
                inputMode="numeric"
                autoComplete="tel"
                placeholder="(21) 90000-0000"
                className="input-mi mt-1 w-full"
              />
            </label>
            <button
              onClick={pedirCodigo}
              disabled={pedindo}
              className="min-h-[44px] rounded-mi bg-mi-marrom-escuro px-5 text-sm text-mi-branco transition-colors hover:bg-mi-marrom disabled:opacity-60"
            >
              {pedindo ? "Pedindo…" : "Quero um código"}
            </button>
          </div>
        )}
        {erroPair && (
          <p role="alert" className="mt-2 text-sm text-mi-erro-tinta">
            {erroPair}
          </p>
        )}
      </div>

      {/* Saída para instância presa: sem isto, QR inválido para sempre. */}
      <div className="mt-6 border-t border-mi-cinza pt-5 text-left">
        <p className="text-sm text-mi-texto/80">
          Tentou e não conectou de jeito nenhum? Comece do zero — isso desliga a
          sessão antiga e gera um código novo em folha.
        </p>
        <button
          onClick={recomecar}
          disabled={resetando}
          className="mt-3 min-h-[44px] rounded-mi border border-mi-marrom px-4 py-2 text-sm text-mi-marrom-escuro transition-colors hover:bg-mi-cinza disabled:opacity-60"
        >
          {resetando ? "Encerrando…" : "Começar de novo"}
        </button>
      </div>
    </div>
  );
}
