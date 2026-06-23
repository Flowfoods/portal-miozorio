import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { OCASIOES_INDICACAO } from "@/lib/clube";
import IndicarForm from "@/components/clube/IndicarForm";

// Página por código: não indexar (link pessoal de compartilhamento).
export const metadata: Metadata = {
  title: "Você foi indicada · Mi Ozorio",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * Captura da indicada (mobile-first — ela chega pelo WhatsApp). Só o primeiro
 * nome da embaixadora aparece; nenhum dado pessoal vive na URL (o código de
 * indicação não identifica ninguém).
 */
export default async function IndicarPage({
  params,
}: {
  params: { codigo: string };
}) {
  const embaixadora = await prisma.customer.findUnique({
    where: { referralCode: params.codigo },
    select: { name: true, clubJoinedAt: true },
  });
  if (!embaixadora?.clubJoinedAt) notFound();

  const primeiroNome = embaixadora.name.split(" ")[0];

  return (
    <main className="mx-auto max-w-lg px-5 pb-24 pt-14">
      <p className="text-center font-corpo text-xs uppercase tracking-[0.3em] text-mi-marrom">
        Clube Mi Ozorio
      </p>
      <h1 className="mt-3 text-center text-3xl leading-tight sm:text-4xl">
        {primeiroNome} indicou você
      </h1>
      <p className="mt-4 text-center font-corpo text-mi-texto/80">
        Maquiagem e penteado com produtos de alta qualidade — e o carinho que
        toda ocasião especial merece. Deixa seu contato que a Mi fala com você
        no WhatsApp.
      </p>

      <div className="mt-10 rounded-mi bg-mi-branco p-6 shadow-suave sm:p-8">
        <IndicarForm codigo={params.codigo} ocasioes={OCASIOES_INDICACAO} />
      </div>
    </main>
  );
}
