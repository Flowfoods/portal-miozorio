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
        <button className="rounded-mi bg-mi-marrom px-4 py-2 text-sm text-white">
          Buscar
        </button>
      </form>

      <div className="overflow-x-auto rounded-mi bg-mi-branco shadow-suave">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-mi-cinza text-left text-xs text-mi-texto/80">
              <th className="px-4 py-3">Nome</th>
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
                  colSpan={6}
                  className="px-4 py-8 text-center text-mi-texto/80"
                >
                  {q
                    ? `Nenhuma cliente encontrada para “${q}”.`
                    : "Nenhuma cliente ainda."}
                </td>
              </tr>
            )}
            {customers.map((c) => (
              <tr key={c.id} className="border-b border-mi-cinza/60">
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
                      className="ml-1.5 rounded bg-red-600 px-1 text-[10px] font-bold text-white"
                    >
                      ⚠
                    </span>
                  )}
                </td>
                <td className="px-4 py-3">{formatPhoneBR(c.phoneE164)}</td>
                <td className="px-4 py-3">{c._count.bookings}</td>
                <td className="px-4 py-3">{c.strikes}</td>
                <td className="px-4 py-3">
                  {c.requiresDeposit ? (
                    <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-900">
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
