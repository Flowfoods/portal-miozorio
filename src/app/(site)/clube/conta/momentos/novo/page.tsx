import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { DateTime } from "luxon";
import { prisma } from "@/lib/prisma";
import { getClienteSession } from "@/lib/cliente-auth";
import { getSettings } from "@/lib/settings";
import ContaShell from "@/components/clube/ContaShell";
import MomentoForm from "@/components/clube/MomentoForm";
import { enviarMomentoAction } from "../actions";

export const metadata: Metadata = {
  title: "Contar um momento · Mi Ozorio",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/** Novo momento (F3). ?atendimento=<bookingId> pré-seleciona (vem do Histórico). */
export default async function NovoMomentoPage({
  searchParams,
}: {
  searchParams: { atendimento?: string };
}) {
  const s = getClienteSession();
  if (!s) redirect("/clube/entrar");
  if (s.prov) redirect("/clube/conta/senha");

  const [settings, bookings] = await Promise.all([
    getSettings(),
    prisma.booking.findMany({
      where: { customerId: s.customerId, status: "completed" },
      orderBy: { startsAt: "desc" },
      take: 12,
      select: {
        id: true,
        startsAt: true,
        service: { select: { name: true } },
      },
    }),
  ]);

  const opcoes = bookings.map((b) => ({
    id: b.id,
    label: `${b.service.name} · ${DateTime.fromJSDate(b.startsAt)
      .setZone(settings.timezone)
      .toFormat("dd/LL/yyyy")}`,
  }));
  const preselecionado = bookings.some((b) => b.id === searchParams.atendimento)
    ? searchParams.atendimento
    : undefined;

  return (
    <ContaShell ativo="momentos">
      <h1 className="font-titulo text-3xl text-mi-marrom-escuro">
        Contar como foi
      </h1>
      <p className="mt-1 font-corpo text-sm text-mi-texto/80">
        Sua história pode inspirar outra cliente a se cuidar também.
      </p>
      <div className="mt-6 rounded-mi bg-mi-branco p-5 shadow-suave">
        <MomentoForm
          action={enviarMomentoAction}
          bookings={opcoes}
          bookingPreselecionado={preselecionado}
        />
      </div>
    </ContaShell>
  );
}
