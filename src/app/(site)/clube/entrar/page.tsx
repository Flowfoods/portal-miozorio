import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getClienteSession } from "@/lib/cliente-auth";
import LoginForm from "@/components/clube/LoginForm";

export const metadata: Metadata = {
  title: "Entrar · Clube Mi Ozorio",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default function EntrarPage() {
  const s = getClienteSession();
  if (s) redirect(s.prov ? "/clube/conta/senha" : "/clube/conta");

  return (
    <main className="mx-auto max-w-md px-5 pb-24 pt-14">
      <p className="text-center font-corpo text-xs uppercase tracking-[0.3em] text-mi-marrom">
        Clube Mi Ozorio
      </p>
      <h1 className="mt-3 text-center font-titulo text-3xl text-mi-marrom-escuro">
        Sua área de pontos
      </h1>
      <p className="mt-3 text-center font-corpo text-mi-texto/80">
        Entre para ver seus pontos, seu link de indicação e os prêmios.
      </p>
      <div className="mt-8 rounded-mi bg-mi-branco p-6 shadow-suave sm:p-8">
        <LoginForm />
      </div>
      <p className="mt-6 text-center font-corpo text-sm text-mi-texto/70">
        Ainda não é cliente?{" "}
        <Link href="/agendar" className="text-mi-marrom underline underline-offset-4">
          Agende seu horário
        </Link>
      </p>
    </main>
  );
}
