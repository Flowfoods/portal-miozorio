"use client";

import { useEffect, useState, useTransition } from "react";
import { startRegistration } from "@simplewebauthn/browser";
import {
  removerPasskeyAction,
  renomearPasskeyAction,
} from "@/lib/passkey-actions";

export interface PasskeyItem {
  id: string;
  deviceName: string;
  createdAt: string | Date;
  lastUsedAt: string | Date | null;
}

/**
 * Gerência de passkeys (Auth F3): ativar Face ID/biometria, listar, renomear e
 * remover. Trocar a senha NÃO remove passkeys — avisamos isso. `area` decide o
 * portal (admin/cliente). Some o botão de ativar se o navegador não suportar.
 */
export default function PasskeyManager({
  area,
  passkeys,
}: {
  area: "admin" | "cliente";
  passkeys: PasskeyItem[];
}) {
  const [supported, setSupported] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    setSupported(typeof window !== "undefined" && !!window.PublicKeyCredential);
  }, []);

  async function ativar() {
    setBusy(true);
    setMsg(null);
    try {
      const optionsJSON = await fetch("/api/auth/passkey/register/options", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ area }),
      }).then((r) => r.json());
      if (optionsJSON?.error) {
        setMsg("Entre na sua conta antes de ativar.");
        return;
      }
      const att = await startRegistration({ optionsJSON });
      const deviceName =
        window.prompt("Dê um nome a este aparelho:", "Meu celular") ||
        "Meu dispositivo";
      const res = await fetch("/api/auth/passkey/register/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ area, response: att, deviceName }),
      }).then((r) => r.json());
      if (res?.ok) {
        setMsg("Pronto! Agora você entra com Face ID/biometria 💛");
        startTransition(() => window.location.reload());
      } else setMsg("Não deu para ativar agora. Tente de novo.");
    } catch (e) {
      if ((e as { name?: string })?.name !== "NotAllowedError") {
        setMsg("Não deu para ativar agora. Tente de novo.");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      {supported ? (
        <button
          type="button"
          onClick={ativar}
          disabled={busy}
          className="rounded-mi bg-mi-marrom-escuro px-4 py-2.5 text-sm text-white transition-opacity disabled:opacity-60"
        >
          {busy ? "Aguarde…" : "Ativar Face ID / biometria"}
        </button>
      ) : (
        <p className="text-xs text-mi-texto/80">
          Este navegador não oferece Face ID/biometria aqui.
        </p>
      )}
      {msg && <p className="mt-2 text-sm text-mi-texto/80">{msg}</p>}

      {passkeys.length > 0 && (
        <ul className="mt-4 divide-y divide-mi-cinza/60">
          {passkeys.map((p) => (
            <li
              key={p.id}
              className="flex items-center justify-between gap-3 py-2.5 text-sm"
            >
              <span className="min-w-0 truncate text-mi-texto/80">
                🔐 {p.deviceName}
              </span>
              <span className="flex shrink-0 gap-3">
                <button
                  type="button"
                  onClick={() => {
                    const nome = window.prompt("Novo nome:", p.deviceName);
                    if (nome)
                      startTransition(() => {
                        renomearPasskeyAction(p.id, nome);
                      });
                  }}
                  disabled={pending}
                  className="text-mi-marrom underline underline-offset-2"
                >
                  Renomear
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm("Remover este acesso por biometria?"))
                      startTransition(() => {
                        removerPasskeyAction(p.id);
                      });
                  }}
                  disabled={pending}
                  className="text-mi-erro-tinta underline underline-offset-2"
                >
                  Remover
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-3 text-xs text-mi-texto/80">
        Trocar a senha não remove os acessos por biometria.
      </p>
    </div>
  );
}
