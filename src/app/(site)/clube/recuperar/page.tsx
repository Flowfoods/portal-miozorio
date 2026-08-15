import Link from "next/link";
import { redirect } from "next/navigation";
import { getClienteSession } from "@/lib/cliente-auth";
import RecuperarForm from "@/components/clube/RecuperarForm";

export const dynamic = "force-dynamic";

export default function RecuperarPage() {
  const s = getClienteSession();
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
        Sem problema — a gente te manda um código no WhatsApp para você criar uma
        senha nova.
      </p>
      <div className="mt-8 rounded-mi bg-mi-branco p-6 shadow-suave sm:p-8">
        <RecuperarForm />
      </div>
      <p className="mt-6 text-center font-corpo text-sm text-mi-texto/80">
        Lembrou a senha?{" "}
        <Link
          href="/clube/entrar"
          className="text-mi-marrom underline underline-offset-4"
        >
          Entrar
        </Link>
      </p>
    </main>
  );
}
