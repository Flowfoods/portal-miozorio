import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatPhoneBR } from "@/lib/format";
import ClientesHubNav from "@/components/admin/ClientesHubNav";
import NovaClienteForm from "@/components/admin/NovaClienteForm";
import { adminResetStrikes } from "../actions";

export const dynamic = "force-dynamic";

export default async function AdminClientesPage({
  searchParams,
}: {
  searchParams: { q?: string };
}) {
  const q = (searchParams.q ?? "").trim();
  const digits = q.replace(/\D/g, "");

  const customers = await prisma.customer.findMany({
    where: q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            ...(digits.length >= 3
              ? [{ phoneE164: { contains: digits } }]
              : []),
          ],
        }
      : undefined,
    orderBy: [{ strikes: "desc" }, { createdAt: "desc" }],
    include: { _count: { select: { bookings: true } } },
    take: 200,
  });

  return (
    <>
      <ClientesHubNav />
      <h1 className="mb-2 text-3xl">Clientes</h1>
      <p className="mb-4 text-sm text-mi-texto/80">
        Toque no nome para abrir a ficha (contato, alergias, anotações e
        histórico). Quem atinge o limite de cancelamentos só reagenda com
        sinal — “Perdoar” zera e libera de novo.
      </p>

      <NovaClienteForm />

      <form className="mb-6 flex max-w-md gap-2" action="/admin/clientes">
        <input
          name="q"
          defaultValue={q}
          placeholder="Buscar por nome ou telefone…"
          className="input-mi w-full"
        />
        <button className="rounded-mi bg-mi-marrom-escuro px-4 py-2 text-sm text-white">
          Buscar
        </button>
      </form>

      {/* Mobile: cards (tabela espremida em 390px é ilegível) */}
      <div className="space-y-3 md:hidden">
        {customers.length === 0 && (
          <p className="rounded-2xl border border-dashed border-mi-marrom-200 bg-mi-marrom-50/60 px-4 py-8 text-center font-corpo text-rotulo text-mi-marrom-700">
            {q ? `Nenhuma cliente encontrada para “${q}”.` : "Nenhuma cliente ainda."}
          </p>
        )}
        {customers.map((c) => (
          <div
            key={c.id}
            className="rounded-2xl border border-mi-marrom-100 bg-mi-branco p-4 shadow-card"
          >
            <div className="flex items-start justify-between gap-2">
              <Link
                href={`/admin/clientes/${c.id}`}
                className="min-w-0 font-corpo font-medium text-mi-marrom-900 underline underline-offset-4"
              >
                {c.name}
              </Link>
              <RfvBadge segmento={c.rfvSegmento} />
            </div>
            <p className="mt-1 font-corpo text-rotulo text-mi-marrom-700">
              {formatPhoneBR(c.phoneE164)}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 font-corpo text-micro text-mi-marrom-700">
              <span>{c._count.bookings} atendimento(s)</span>
              <span>{c.strikes} cancelamento(s)</span>
              {(c.allergies ?? "").trim() && (
                <span className="rounded-full bg-mi-erro/10 px-2 py-0.5 font-medium text-mi-erro-tinta">
                  ⚠ alergia na ficha
                </span>
              )}
              {c.requiresDeposit && (
                <span className="rounded-full bg-mi-erro/10 px-2 py-0.5 font-medium text-mi-erro-tinta">
                  sinal exigido
                </span>
              )}
            </div>
            {(c.strikes > 0 || c.requiresDeposit) && (
              <form action={adminResetStrikes.bind(null, c.id)} className="mt-3">
                <button className="min-h-[44px] rounded-mi border border-mi-marrom-200 px-4 font-corpo text-rotulo text-mi-marrom-800">
                  Perdoar
                </button>
              </form>
            )}
          </div>
        ))}
      </div>

      <div className="hidden overflow-x-auto rounded-2xl border border-mi-marrom-100 bg-mi-branco shadow-card md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-mi-cinza text-left font-corpo text-micro uppercase text-mi-marrom-700">
              <th className="px-4 py-3">Nome</th>
              <th className="px-4 py-3">Segmento</th>
              <th className="px-4 py-3">WhatsApp</th>
              <th className="px-4 py-3">Atendimentos</th>
              <th className="px-4 py-3">Cancelamentos</th>
              <th className="px-4 py-3">Sinal exigido?</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {customers.length === 0 && (
              <tr>
                <td
                  colSpan={7}
                  className="px-4 py-8 text-center text-mi-texto/80"
                >
                  {q
                    ? `Nenhuma cliente encontrada para “${q}”.`
                    : "Nenhuma cliente ainda."}
                </td>
              </tr>
            )}
            {customers.map((c, i) => (
              <tr
                key={c.id}
                className={`border-b border-mi-cinza/60 ${i % 2 === 1 ? "bg-mi-marrom-50/60" : ""}`}
              >
                <td className="px-4 py-3">
                  <Link
                    href={`/admin/clientes/${c.id}`}
                    className="font-medium text-mi-marrom-escuro underline underline-offset-4"
                  >
                    {c.name}
                  </Link>
                  {(c.allergies ?? "").trim() && (
                    <span
                      title="Alergia registrada na ficha"
                      className="ml-1.5 rounded bg-mi-erro px-1 text-[10px] font-bold text-white"
                    >
                      ⚠
                    </span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <RfvBadge segmento={c.rfvSegmento} />
                </td>
                <td className="px-4 py-3">{formatPhoneBR(c.phoneE164)}</td>
                <td className="px-4 py-3">{c._count.bookings}</td>
                <td className="px-4 py-3">{c.strikes}</td>
                <td className="px-4 py-3">
                  {c.requiresDeposit ? (
                    <span className="rounded-full bg-mi-erro/10 px-2 py-0.5 text-xs text-mi-erro-tinta">
                      sim
                    </span>
                  ) : (
                    <span className="text-xs text-mi-texto/80">não</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  {(c.strikes > 0 || c.requiresDeposit) && (
                    <form action={adminResetStrikes.bind(null, c.id)}>
                      <button className="rounded-mi border border-mi-cinza px-3 py-1 text-xs">
                        Perdoar
                      </button>
                    </form>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

/** Badge do segmento RFV (calculado pelo job diário) na paleta de dados. */
function RfvBadge({ segmento }: { segmento: string | null }) {
  if (!segmento) return null;
  const estilo: Record<string, string> = {
    Campeãs: "bg-mi-sucesso/15 text-mi-sucesso-tinta",
    Fiéis: "bg-mi-marrom-100 text-mi-marrom-800",
    Promissoras: "bg-mi-marrom-50 text-mi-marrom-700",
    "Em risco": "bg-mi-alerta/10 text-mi-alerta-tinta",
    Hibernando: "bg-mi-cinza text-mi-texto",
  };
  return (
    <span
      className={`inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 font-corpo text-micro font-medium ${
        estilo[segmento] ?? "bg-mi-marrom-50 text-mi-marrom-700"
      }`}
    >
      {segmento}
    </span>
  );
}
