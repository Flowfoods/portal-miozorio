import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getClienteSession } from "@/lib/cliente-auth";
import { listarPasskeysDoSujeito } from "@/lib/passkeys";
import { formatPhoneBR } from "@/lib/format";
import ContaShell from "@/components/clube/ContaShell";
import PasskeyManager from "@/components/auth/PasskeyManager";
import { sairAction } from "../actions";

export const metadata: Metadata = {
  title: "Meu perfil · Mi Ozorio",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * Perfil da Área da Cliente (F1): dados de contato (leitura), troca de senha
 * e sair. Edição de dados fica com a Mi (evita superfície nova de mutação
 * nesta fase — telefone é a identidade do login).
 */
export default async function PerfilPage() {
  const s = getClienteSession();
  if (!s) redirect("/clube/entrar");
  if (s.prov) redirect("/clube/conta/senha");

  const customer = await prisma.customer.findUnique({
    where: { id: s.customerId },
    select: { name: true, phoneE164: true, email: true, clubJoinedAt: true },
  });
  if (!customer) redirect("/clube/entrar");

  const passkeys = (await listarPasskeysDoSujeito("cliente", s.customerId)).map(
    (p) => ({
      ...p,
      createdAt: p.createdAt.toISOString(),
      lastUsedAt: p.lastUsedAt ? p.lastUsedAt.toISOString() : null,
    }),
  );

  return (
    <ContaShell ativo="perfil">
      <h1 className="font-titulo text-3xl text-mi-marrom-escuro">Meu perfil</h1>

      <section className="mt-4 space-y-3 rounded-mi bg-mi-branco p-5 shadow-suave">
        <div>
          <p className="font-corpo text-xs uppercase tracking-wide text-mi-texto/80">
            Nome
          </p>
          <p className="font-corpo text-mi-texto">{customer.name}</p>
        </div>
        <div>
          <p className="font-corpo text-xs uppercase tracking-wide text-mi-texto/80">
            WhatsApp
          </p>
          <p className="font-corpo text-mi-texto">
            {formatPhoneBR(customer.phoneE164)}
          </p>
        </div>
        {customer.email && (
          <div>
            <p className="font-corpo text-xs uppercase tracking-wide text-mi-texto/80">
              E-mail
            </p>
            <p className="font-corpo text-mi-texto">{customer.email}</p>
          </div>
        )}
        <p className="border-t border-mi-cinza/60 pt-3 font-corpo text-xs text-mi-texto/80">
          Precisa atualizar algum dado? É só falar com a Mi no WhatsApp 💛
        </p>
      </section>

      <section className="mt-6 rounded-mi bg-mi-branco p-5 shadow-suave">
        <h2 className="font-titulo text-lg text-mi-marrom-escuro">
          Entrar com Face ID / biometria
        </h2>
        <p className="mb-3 mt-1 font-corpo text-xs text-mi-texto/80">
          Ative para entrar sem digitar senha, usando o reconhecimento do seu
          celular. Sua senha continua valendo 💛
        </p>
        <PasskeyManager area="cliente" passkeys={passkeys} />
      </section>

      <section className="mt-6 space-y-3">
        <Link
          href="/clube/conta/senha"
          className="flex min-h-[52px] items-center justify-between rounded-mi border border-mi-cinza bg-mi-branco px-5 font-corpo text-mi-texto shadow-suave transition-colors hover:border-mi-marrom"
        >
          Trocar minha senha
          <span aria-hidden className="text-mi-marrom">
            ›
          </span>
        </Link>
        <form action={sairAction}>
          <button className="flex min-h-[52px] w-full items-center justify-between rounded-mi border border-mi-cinza bg-mi-branco px-5 font-corpo text-mi-texto shadow-suave transition-colors hover:border-mi-marrom">
            Sair da minha área
            <span aria-hidden className="text-mi-marrom">
              ›
            </span>
          </button>
        </form>
      </section>
    </ContaShell>
  );
}
