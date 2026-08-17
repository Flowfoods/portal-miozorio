"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { startAuthentication } from "@simplewebauthn/browser";

/**
 * Botão "Entrar com Face ID / biometria" (Auth F3) — some se o navegador não
 * suporta. Cliente entra via cookie (rota verify); admin via provider "passkey"
 * do NextAuth. Passkey é atalho: a senha continua logo acima como fallback.
 */
export default function PasskeyLoginButton({
  area,
}: {
  area: "admin" | "cliente";
}) {
  const [supported, setSupported] = useState(false);
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    setSupported(
      typeof window !== "undefined" && !!window.PublicKeyCredential,
    );
  }, []);
  if (!supported) return null;

  async function entrar() {
    setBusy(true);
    setErro(null);
    try {
      const optionsJSON = await fetch(
        "/api/auth/passkey/authenticate/options",
        { method: "POST" },
      ).then((r) => r.json());
      const asr = await startAuthentication({ optionsJSON });

      if (area === "cliente") {
        const res = await fetch("/api/auth/passkey/authenticate/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ response: asr }),
        }).then((r) => r.json());
        if (res?.ok) {
          router.push(res.redirect ?? "/clube/conta");
          router.refresh();
        } else setErro("Não deu para entrar com biometria. Use sua senha 🤎");
      } else {
        const r = await signIn("passkey", {
          assertion: JSON.stringify(asr),
          redirect: false,
        });
        if (r?.ok) {
          router.push("/admin");
          router.refresh();
        } else setErro("Não deu para entrar com biometria. Use sua senha 🤎");
      }
    } catch (e) {
      // Cancelar o Face ID não é erro (NotAllowedError) — fica quieto.
      if ((e as { name?: string })?.name !== "NotAllowedError") {
        setErro("Não deu para entrar com biometria. Use sua senha 🤎");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={entrar}
        disabled={busy}
        className="flex w-full items-center justify-center gap-2 rounded-mi border border-mi-marrom px-4 py-3 font-corpo text-mi-marrom transition-colors hover:bg-mi-marrom-escuro hover:text-white disabled:opacity-60"
      >
        {busy ? "Aguarde…" : "Entrar com Face ID / biometria"}
      </button>
      {erro && (
        <p role="alert" className="mt-2 text-sm text-mi-erro-tinta">
          {erro}
        </p>
      )}
    </div>
  );
}
