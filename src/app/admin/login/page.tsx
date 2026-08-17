"use client";

import { Suspense, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import PasswordField from "@/components/auth/PasswordField";
import PasskeyLoginButton from "@/components/auth/PasskeyLoginButton";

// Mensagem ÚNICA (anti-enumeração): nunca diferencia "e-mail não existe" de
// "senha errada". Tom da Mi.
const ERRO_GENERICO = "E-mail ou senha incorretos. Tente novamente 🤎";

function LoginForm() {
  const router = useRouter();
  const search = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [shakeKey, setShakeKey] = useState(0); // re-dispara a animação a cada erro
  const senhaRef = useRef<HTMLInputElement>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (loading) return; // sem duplo submit
    setError(null);
    setLoading(true);
    const res = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });
    setLoading(false);
    if (res?.ok) {
      router.push(search.get("callbackUrl") ?? "/admin");
      router.refresh();
    } else {
      setError(ERRO_GENERICO);
      setShakeKey((k) => k + 1);
      setPassword("");
      senhaRef.current?.focus();
    }
  }

  return (
    <div key={shakeKey} className={`mx-auto max-w-sm ${error ? "mi-shake" : ""}`}>
      <h1 className="mb-2 text-3xl">Painel da Mi</h1>
      <p className="mb-8 text-sm text-mi-texto/80">
        Acesso restrito. Entre com sua conta do estúdio.
      </p>
      {search.get("reset") === "ok" && (
        <p className="mb-6 rounded-mi bg-mi-sucesso/10 px-4 py-3 text-sm text-mi-sucesso-tinta">
          Senha redefinida. Entre com a nova senha.
        </p>
      )}
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <input
          className="input-mi"
          type="email"
          inputMode="email"
          placeholder="E-mail"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="username"
          required
        />
        <PasswordField
          ref={senhaRef}
          placeholder="Senha"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          required
        />
        {error && (
          <p role="alert" className="text-sm text-mi-erro-tinta">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={loading}
          aria-busy={loading}
          className="flex w-full items-center justify-center gap-2 rounded-mi bg-mi-marrom-escuro px-4 py-3 text-white transition-opacity disabled:opacity-60"
        >
          {loading && (
            <span
              aria-hidden="true"
              className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white"
            />
          )}
          {loading ? "Entrando…" : "Entrar"}
        </button>
      </form>

      <div className="my-5 flex items-center gap-3 text-xs text-mi-texto/40">
        <span className="h-px flex-1 bg-mi-cinza" />
        ou
        <span className="h-px flex-1 bg-mi-cinza" />
      </div>
      <PasskeyLoginButton area="admin" />

      <p className="mt-6 text-center text-sm">
        <Link href="/admin/recuperar" className="text-mi-marrom underline">
          Esqueci a senha
        </Link>
      </p>
    </div>
  );
}

export default function AdminLoginPage() {
  // useSearchParams exige Suspense no prerender do Next 14.
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
