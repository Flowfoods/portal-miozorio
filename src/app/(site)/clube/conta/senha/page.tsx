import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getClienteSession, hrefLoginCliente } from "@/lib/cliente-auth";
import { caminhoSeguro } from "@/lib/auth-rotas";
import AuthShell from "@/components/auth/AuthShell";
import SenhaForm from "@/components/clube/SenhaForm";

export const metadata: Metadata = {
  title: "Definir senha · Clube Mi Ozorio",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function SenhaPage({
  searchParams,
}: {
  searchParams?: { callbackUrl?: string };
}) {
  const s = await getClienteSession();
  if (!s) redirect(hrefLoginCliente());
  const destino = caminhoSeguro(searchParams?.callbackUrl, "/clube/conta");

  return (
    <AuthShell
      eyebrow="Clube Mi Ozorio"
      monograma={false}
      titulo={s.prov ? "Crie sua senha" : "Trocar senha"}
      subtitulo={
        s.prov
          ? "Por segurança, defina uma senha só sua antes de continuar."
          : "Escolha uma nova senha para sua conta."
      }
      rodape={
        s.prov ? undefined : (
          <p>
            Mudou de ideia?{" "}
            <Link
              href="/clube/conta"
              className="text-mi-marrom underline underline-offset-4"
            >
              Voltar para a minha conta
            </Link>
          </p>
        )
      }
    >
      <SenhaForm provisoria={s.prov} callbackUrl={destino} />
    </AuthShell>
  );
}
