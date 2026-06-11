import { prisma } from "@/lib/prisma";
import AdminNav from "@/components/admin/AdminNav";
import { adminResetStrikes } from "../actions";

export const dynamic = "force-dynamic";

export default async function AdminClientesPage() {
  const customers = await prisma.customer.findMany({
    orderBy: [{ strikes: "desc" }, { createdAt: "desc" }],
    include: { _count: { select: { bookings: true } } },
    take: 200,
  });

  return (
    <>
      <AdminNav />
      <h1 className="mb-2 text-3xl">Clientes</h1>
      <p className="mb-6 text-sm text-mi-texto/70">
        Quem atinge o limite de cancelamentos só reagenda com sinal. “Perdoar”
        zera os cancelamentos e libera de novo.
      </p>

      <div className="overflow-x-auto rounded-mi bg-mi-branco shadow-suave">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-mi-cinza text-left text-xs text-mi-texto/60">
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
                  className="px-4 py-8 text-center text-mi-texto/60"
                >
                  Nenhuma cliente ainda.
                </td>
              </tr>
            )}
            {customers.map((c) => (
              <tr key={c.id} className="border-b border-mi-cinza/60">
                <td className="px-4 py-3">{c.name}</td>
                <td className="px-4 py-3">{c.phoneE164}</td>
                <td className="px-4 py-3">{c._count.bookings}</td>
                <td className="px-4 py-3">{c.strikes}</td>
                <td className="px-4 py-3">
                  {c.requiresDeposit ? (
                    <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-900">
                      sim
                    </span>
                  ) : (
                    <span className="text-xs text-mi-texto/50">não</span>
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
