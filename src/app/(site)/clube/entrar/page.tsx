import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getClienteSession } from "@/lib/cliente-auth";
import LoginForm from "@/components/clube/LoginForm";
import AuthShell from "@/components/auth/AuthShell";
import { caminhoSeguro } from "@/lib/auth-rotas";

export const metadata: Metadata = {
  title: "Entrar · Clube Mi Ozorio",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function EntrarPage({
  searchParams,
}: {
  searchParams?: { callbackUrl?: string };
}) {
  const s = await getClienteSession();
  // Já logada: se ela veio de uma página protegida, vai direto para lá.
  const destino = caminhoSeguro(searchParams?.callbackUrl, "/clube/conta");
  if (s) redirect(s.prov ? "/clube/conta/senha" : destino);

  return (
    <AuthShell
      eyebrow="Clube Mi Ozorio"
      titulo="Que bom te ver por aqui 💛"
      subtitulo="Entre para ver seus pontos, seu link de indicação e os prêmios."
      rodape={
        <p>
          Ainda não é cliente?{" "}
          <Link
            href="/agendar"
            className="text-mi-marrom-700 underline underline-offset-4"
          >
            Agende seu horário
          </Link>
        </p>
      }
    >
      <LoginForm callbackUrl={searchParams?.callbackUrl} />
    </AuthShell>
  );
}
