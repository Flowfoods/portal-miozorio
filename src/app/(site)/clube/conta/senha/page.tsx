import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getClienteSession } from "@/lib/cliente-auth";
import SenhaForm from "@/components/clube/SenhaForm";

export const metadata: Metadata = {
  title: "Definir senha · Clube Mi Ozorio",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default function SenhaPage() {
  const s = getClienteSession();
  if (!s) redirect("/clube/entrar");

  return (
    <main className="mx-auto max-w-md px-5 pb-24 pt-14">
      <h1 className="text-center font-titulo text-3xl text-mi-marrom-escuro">
        {s.prov ? "Crie sua senha" : "Trocar senha"}
      </h1>
      <p className="mt-3 text-center font-corpo text-mi-texto/80">
        {s.prov
          ? "Por segurança, defina uma senha só sua antes de continuar."
          : "Escolha uma nova senha para sua conta."}
      </p>
      <div className="mt-8 rounded-mi bg-mi-branco p-6 shadow-suave sm:p-8">
        <SenhaForm provisoria={s.prov} />
      </div>
    </main>
  );
}
