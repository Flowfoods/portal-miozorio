import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getClienteSession, CLUB_MIN_SENHA } from "@/lib/cliente-auth";
import { waLinkMsg } from "@/lib/format";
import { caminhoSeguro } from "@/lib/auth-rotas";
import AuthShell from "@/components/auth/AuthShell";
import RecuperarFluxo from "@/components/auth/RecuperarFluxo";

export const metadata: Metadata = {
  title: "Recuperar acesso · Clube Mi Ozorio",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const MI = process.env.MI_WHATSAPP ?? "+5521970225231";

export default async function RecuperarPage({
  searchParams,
}: {
  searchParams?: { callbackUrl?: string };
}) {
  const s = await getClienteSession();
  const destino = caminhoSeguro(searchParams?.callbackUrl, "/clube/conta");
  if (s) redirect(s.prov ? "/clube/conta/senha" : destino);

  return (
    <AuthShell
      eyebrow="Clube Mi Ozorio"
      titulo="Recuperar acesso"
      subtitulo="Sem problema — a Mi te manda um código no WhatsApp para você criar uma senha nova."
    >
      <RecuperarFluxo
        perfil="cliente"
        waMi={waLinkMsg(
          MI,
          "Oi, Mi! Esqueci minha senha do Clube e pedi um código pelo site. Consegue me mandar? 💛",
        )}
        destino={destino}
        entrarHref="/clube/entrar"
        cadastrarHref="/clube"
        minSenha={CLUB_MIN_SENHA}
      />
    </AuthShell>
  );
}
