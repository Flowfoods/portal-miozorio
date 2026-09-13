"use client";

import { Suspense, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import PasswordField from "@/components/auth/PasswordField";
import PasskeyLoginButton from "@/components/auth/PasskeyLoginButton";
import AuthShell from "@/components/auth/AuthShell";
import { mensagemLoginAdmin } from "@/lib/auth-mensagens";
import { caminhoSeguro } from "@/lib/auth-rotas";

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
      router.push(caminhoSeguro(search.get("callbackUrl"), "/admin"));
      router.refresh();
    } else {
      // B1/B5 — o motor devolve um código ("MUITAS_TENTATIVAS",
      // "CONTA_PAUSADA:12"); aqui ele vira frase. Erro de credencial continua
      // com a mensagem única (não revela se o e-mail existe).
      setError(mensagemLoginAdmin(res?.error));
      setShakeKey((k) => k + 1);
      setPassword("");
      senhaRef.current?.focus();
    }
  }

  return (
    <AuthShell
      eyebrow="Painel da Mi"
      titulo="Bem-vinda de volta 💛"
      subtitulo="Acesso restrito. Entre com sua conta do estúdio."
      rodape={
        <p>
          <Link
            href="/admin/recuperar"
            className="text-mi-marrom underline underline-offset-4"
          >
            Esqueci a senha
          </Link>
        </p>
      }
    >
      <div key={shakeKey} className={error ? "mi-shake" : ""}>
        {search.get("reset") === "ok" && (
          <p className="mb-6 rounded-mi bg-mi-sucesso/10 px-4 py-3 text-sm text-mi-sucesso-tinta">
            Senha redefinida. Entre com a nova senha.
          </p>
        )}
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <label className="block">
            <span className="mb-1 block font-corpo text-sm text-mi-texto/80">
              E-mail
            </span>
            <input
              className="input-mi"
              type="email"
              inputMode="email"
              placeholder="voce@exemplo.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              required
            />
          </label>
          <label className="block">
            <span className="mb-1 block font-corpo text-sm text-mi-texto/80">
              Senha
            </span>
            <PasswordField
              ref={senhaRef}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </label>
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

        <div className="my-5 flex items-center gap-3 text-xs text-mi-texto/80">
          <span className="h-px flex-1 bg-mi-cinza" />
          ou
          <span className="h-px flex-1 bg-mi-cinza" />
        </div>
        <PasskeyLoginButton area="admin" />
      </div>
    </AuthShell>
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
