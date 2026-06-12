import Link from "next/link";
import { DateTime } from "luxon";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";
import {
  segmentoDe,
  SEGMENTO_LABEL,
  SEGMENTO_STYLE,
  type SegmentoClube,
} from "@/lib/clube";
import AdminNav from "@/components/admin/AdminNav";
import { adminRedeemMilestone } from "../actions";

export const dynamic = "force-dynamic";

/**
 * Clube no painel da Mi: mimos a entregar (marcos da escada), membros com
 * segmento calculado na hora (sem job — quando o M4/n8n existir, o recálculo
 * diário pode persistir isso) e indicações aguardando primeiro atendimento.
 */
export default async function AdminClubePage() {
  const settings = await getSettings();
  const tz = settings.timezone;

  const [pendentes, membros, indicadasSemAtendimento] = await Promise.all([
    prisma.referralMilestone.findMany({
      where: { resgatadoEm: null },
      include: { customer: { select: { id: true, name: true } } },
      orderBy: { liberadoEm: "asc" },
    }),
    prisma.customer.findMany({
      where: { clubJoinedAt: { not: null } },
      include: {
        _count: {
          select: {
            bookings: { where: { status: "completed" } },
            referrals: true,
          },
        },
      },
      orderBy: { clubJoinedAt: "desc" },
      take: 200,
    }),
    prisma.customer.findMany({
      where: {
        referredById: { not: null },
        bookings: { none: { status: "completed" } },
      },
      include: { referredBy: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 30,
    }),
  ]);

  const ids = membros.map((m) => m.id);
  // Última ocasião e indicações fechadas em 2 consultas agregadas (não N+1).
  const [ultimas, fechadasPorMembro] = await Promise.all([
    prisma.booking.groupBy({
      by: ["customerId"],
      where: { customerId: { in: ids }, status: "completed" },
      _max: { startsAt: true },
    }),
    prisma.customer.groupBy({
      by: ["referredById"],
      where: {
        referredById: { in: ids },
        bookings: { some: { status: "completed" } },
      },
      _count: { _all: true },
    }),
  ]);
  const ultimaPor = new Map(ultimas.map((u) => [u.customerId, u._max.startsAt]));
  const fechadasPor = new Map(
    fechadasPorMembro.map((f) => [f.referredById, f._count._all]),
  );

  const comSegmento = membros.map((m) => ({
    ...m,
    fechadas: fechadasPor.get(m.id) ?? 0,
    segmento: segmentoDe({
      ocasioes: m._count.bookings,
      ultimaOcasiao: ultimaPor.get(m.id) ?? null,
      indicacoesFechadas: fechadasPor.get(m.id) ?? 0,
    }) as SegmentoClube,
  }));

  return (
    <>
      <AdminNav />
      <h1 className="mb-2 text-3xl">Clube</h1>
      <p className="mb-6 text-sm text-mi-texto/70">
        Indicações e mimos. O marco aparece sozinho quando você conclui o
        atendimento de uma cliente indicada — aqui você marca o mimo como
        entregue.
      </p>

      {/* Mimos a entregar */}
      <section className="mb-10">
        <h2 className="mb-3 text-xl">
          Mimos a entregar{" "}
          {pendentes.length > 0 && (
            <span className="rounded-full bg-amber-100 px-3 py-0.5 text-sm text-amber-900">
              {pendentes.length}
            </span>
          )}
        </h2>
        {pendentes.length === 0 && (
          <p className="rounded-mi bg-mi-branco p-5 text-sm text-mi-texto/60 shadow-suave">
            Nenhum mimo pendente.
          </p>
        )}
        <div className="space-y-2">
          {pendentes.map((m) => (
            <div
              key={m.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-mi bg-mi-branco p-4 shadow-suave"
            >
              <div className="text-sm">
                <Link
                  href={`/admin/clientes/${m.customer.id}`}
                  className="font-medium underline underline-offset-4"
                >
                  {m.customer.name}
                </Link>{" "}
                · {m.nivel}ª indicação realizada
                <p className="text-mi-texto/70">{m.beneficio}</p>
                <p className="text-xs text-mi-texto/50">
                  liberado em{" "}
                  {DateTime.fromJSDate(m.liberadoEm)
                    .setZone(tz)
                    .toFormat("dd/LL/yyyy")}
                </p>
              </div>
              <form action={adminRedeemMilestone.bind(null, m.id)}>
                <button className="rounded-mi bg-mi-marrom px-4 py-2 text-sm text-white">
                  Marcar como entregue
                </button>
              </form>
            </div>
          ))}
        </div>
      </section>

      {/* Indicações aguardando primeiro atendimento */}
      {indicadasSemAtendimento.length > 0 && (
        <section className="mb-10">
          <h2 className="mb-3 text-xl">Indicações aguardando atendimento</h2>
          <div className="overflow-x-auto rounded-mi bg-mi-branco shadow-suave">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-mi-cinza text-left text-xs text-mi-texto/60">
                  <th className="px-4 py-3">Indicada</th>
                  <th className="px-4 py-3">Quem indicou</th>
                  <th className="px-4 py-3">Interesse</th>
                  <th className="px-4 py-3">Chegou em</th>
                </tr>
              </thead>
              <tbody>
                {indicadasSemAtendimento.map((c) => (
                  <tr key={c.id} className="border-b border-mi-cinza/60">
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/clientes/${c.id}`}
                        className="underline underline-offset-4"
                      >
                        {c.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3">{c.referredBy?.name ?? "—"}</td>
                    <td className="px-4 py-3 text-mi-texto/70">
                      {c.clubInterest ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-mi-texto/70">
                      {DateTime.fromJSDate(c.createdAt)
                        .setZone(tz)
                        .toFormat("dd/LL/yyyy")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Membros */}
      <section>
        <h2 className="mb-3 text-xl">Membros ({membros.length})</h2>
        <div className="overflow-x-auto rounded-mi bg-mi-branco shadow-suave">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-mi-cinza text-left text-xs text-mi-texto/60">
                <th className="px-4 py-3">Nome</th>
                <th className="px-4 py-3">Momento</th>
                <th className="px-4 py-3">Indicações fechadas</th>
                <th className="px-4 py-3">Atendimentos</th>
                <th className="px-4 py-3">Entrou em</th>
              </tr>
            </thead>
            <tbody>
              {comSegmento.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-mi-texto/60">
                    Nenhuma membro ainda — inclua clientes pela ficha delas.
                  </td>
                </tr>
              )}
              {comSegmento.map((m) => (
                <tr key={m.id} className="border-b border-mi-cinza/60">
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/clientes/${m.id}`}
                      className="underline underline-offset-4"
                    >
                      {m.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs ${SEGMENTO_STYLE[m.segmento]}`}
                    >
                      {SEGMENTO_LABEL[m.segmento]}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {m.fechadas}
                    {m._count.referrals > m.fechadas && (
                      <span className="text-xs text-mi-texto/50">
                        {" "}
                        (+{m._count.referrals - m.fechadas} aguardando)
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">{m._count.bookings}</td>
                  <td className="px-4 py-3 text-mi-texto/70">
                    {m.clubJoinedAt
                      ? DateTime.fromJSDate(m.clubJoinedAt)
                          .setZone(tz)
                          .toFormat("dd/LL/yyyy")
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
