import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getClienteSession } from "@/lib/cliente-auth";
import ContaShell from "@/components/clube/ContaShell";
import MomentoForm from "@/components/clube/MomentoForm";
import { editarMomentoAction } from "../../actions";

export const metadata: Metadata = {
  title: "Editar momento · Mi Ozorio",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/** Edição do próprio momento (F3) — reenvia para a moderação da Mi. */
export default async function EditarMomentoPage({
  params,
}: {
  params: { id: string };
}) {
  const s = getClienteSession();
  if (!s) redirect("/clube/entrar");
  if (s.prov) redirect("/clube/conta/senha");

  // Só o dono, só origem cliente, arquivado não edita (isolamento).
  const momento = await prisma.testimonial
    .findFirst({
      where: {
        id: params.id,
        customerId: s.customerId,
        origem: "cliente",
        status: { in: ["pendente", "aprovado", "rejeitado"] },
      },
      include: { photos: { orderBy: { ordem: "asc" } } },
    })
    .catch(() => null);
  if (!momento) notFound();

  return (
    <ContaShell ativo="momentos">
      <h1 className="font-titulo text-3xl text-mi-marrom-escuro">
        Editar momento
      </h1>
      <p className="mt-1 font-corpo text-sm text-mi-texto/70">
        Depois de editar, a Mi lê de novo antes de publicar.
      </p>
      <div className="mt-6 rounded-mi bg-mi-branco p-5 shadow-suave">
        <MomentoForm
          action={editarMomentoAction}
          editar={{
            id: momento.id,
            texto: momento.quote,
            rating: momento.rating,
            fotos: momento.photos.map((f) => ({
              id: f.id,
              url: `/momentos/foto/${f.id}`,
            })),
          }}
        />
      </div>
    </ContaShell>
  );
}
