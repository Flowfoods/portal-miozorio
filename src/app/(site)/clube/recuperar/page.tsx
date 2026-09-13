import { redirect } from "next/navigation";
import { getClienteSession, CLUB_MIN_SENHA } from "@/lib/cliente-auth";
import { waLinkMsg } from "@/lib/format";
import RecuperarFluxo from "@/components/auth/RecuperarFluxo";

export const dynamic = "force-dynamic";

const MI = process.env.MI_WHATSAPP ?? "+5521970225231";

export default async function RecuperarPage() {
  const s = await getClienteSession();
  if (s) redirect(s.prov ? "/clube/conta/senha" : "/clube/conta");

  return (
    <main className="mx-auto max-w-md px-5 pb-24 pt-14">
      <p className="text-center font-corpo text-xs uppercase tracking-[0.3em] text-mi-marrom-escuro">
        Clube Mi Ozorio
      </p>
      <h1 className="mt-3 text-center font-titulo text-3xl text-mi-marrom-escuro">
        Recuperar acesso
      </h1>
      <p className="mt-3 text-center font-corpo text-mi-texto/80">
        Sem problema — a Mi te manda um código no WhatsApp para você criar uma
        senha nova.
      </p>
      <div className="mt-8 rounded-mi bg-mi-branco p-6 shadow-suave sm:p-8">
        <RecuperarFluxo
          perfil="cliente"
          waMi={waLinkMsg(
            MI,
            "Oi, Mi! Esqueci minha senha do Clube e pedi um código pelo site. Consegue me mandar? 💛",
          )}
          destino="/clube/conta"
          entrarHref="/clube/entrar"
          cadastrarHref="/clube"
          minSenha={CLUB_MIN_SENHA}
        />
      </div>
    </main>
  );
}
