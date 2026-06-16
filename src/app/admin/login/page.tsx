"use client";

import { Suspense, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";

function LoginForm() {
  const router = useRouter();
  const search = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
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
      setError("E-mail ou senha incorretos.");
    }
  }

  return (
    <div className="mx-auto max-w-sm">
      <h1 className="mb-2 text-3xl">Painel da Mi</h1>
      <p className="mb-8 text-sm text-mi-texto/70">
        Acesso restrito. Entre com sua conta do estúdio.
      </p>
      {search.get("reset") === "ok" && (
        <p className="mb-6 rounded-mi bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          Senha redefinida. Entre com a nova senha.
        </p>
      )}
      <form onSubmit={onSubmit} className="space-y-4">
        <input
          className="input-mi"
          type="email"
          placeholder="E-mail"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="username"
          required
        />
        <input
          className="input-mi"
          type="password"
          placeholder="Senha"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          required
        />
        {error && <p className="text-sm text-red-700">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-mi bg-mi-marrom px-4 py-3 text-white transition-opacity disabled:opacity-60"
        >
          {loading ? "Entrando…" : "Entrar"}
        </button>
      </form>
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
