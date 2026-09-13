import { waLinkMsg } from "@/lib/format";
import { MIN_SENHA } from "@/lib/security";
import { caminhoSeguro } from "@/lib/auth-rotas";
import AuthShell from "@/components/auth/AuthShell";
import RecuperarFluxo from "@/components/auth/RecuperarFluxo";

export const dynamic = "force-dynamic";

const MI = process.env.MI_WHATSAPP ?? "+5521970225231";

/**
 * Recuperação da senha do painel (B2) — mesmo modelo da cliente: código de 6
 * dígitos no WhatsApp da Mi. Quando é a própria Mi que esqueceu, o código chega
 * no WhatsApp dela mesma; se o número principal estiver fora do ar, o código
 * também vai para o contato de emergência (`MI_WHATSAPP_EMERGENCIA`).
 * O antigo link por e-mail saiu de cena: um modelo só, para todo mundo.
 */
export default function RecuperarPage({
  searchParams,
}: {
  searchParams?: { callbackUrl?: string };
}) {
  const destino = caminhoSeguro(searchParams?.callbackUrl, "/admin");
  return (
    <AuthShell
      eyebrow="Painel da Mi"
      titulo="Esqueci a senha"
      subtitulo="Informe o e-mail da conta do estúdio. O código de 6 números chega no WhatsApp da Mi — é só digitar aqui e criar a senha nova."
    >
      <RecuperarFluxo
        perfil="admin"
        waMi={waLinkMsg(
          MI,
          "Oi, Mi! Pedi um código para recuperar o acesso ao painel. 💛",
        )}
        destino={destino}
        entrarHref="/admin/login"
        minSenha={MIN_SENHA}
      />
    </AuthShell>
  );
}
