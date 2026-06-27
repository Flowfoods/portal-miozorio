import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";
import ClientesHubNav from "@/components/admin/ClientesHubNav";
import {
  adminCreateReward,
  adminUpdateReward,
  adminDeleteReward,
  adminSetPointsPerReferral,
} from "../actions";

export const dynamic = "force-dynamic";

/**
 * Clube por PONTOS (Anexo 1): a Mi configura pontos por indicação, monta o
 * catálogo de recompensas e vê o saldo de cada membro. Pontos por serviço
 * ficam em /admin/servicos; saldo/extrato/resgate por cliente, na ficha.
 */
export default async function AdminClubePage() {
  const [settings, rewards, membros, saldos] = await Promise.all([
    getSettings(),
    prisma.clubReward.findMany({ orderBy: [{ sort: "asc" }, { nome: "asc" }] }),
    prisma.customer.findMany({
      where: { clubJoinedAt: { not: null } },
      select: { id: true, name: true },
      orderBy: { clubJoinedAt: "desc" },
      take: 300,
    }),
    prisma.clubTransaction.groupBy({
      by: ["customerId"],
      _sum: { pontos: true },
    }),
  ]);

  const saldoPorCliente = new Map(
    saldos.map((s) => [s.customerId, s._sum.pontos ?? 0]),
  );
  const membrosComSaldo = membros
    .map((m) => ({ ...m, saldo: saldoPorCliente.get(m.id) ?? 0 }))
    .sort((a, b) => b.saldo - a.saldo);

  return (
    <>
      <ClientesHubNav />
      <h1 className="mb-2 text-3xl">Clube de fidelidade</h1>
      <p className="mb-6 text-sm text-mi-texto/70">
        Suas clientes ganham pontos por atendimento (configure em Serviços) e por
        indicação que se concretiza. Aqui você define os pontos por indicação e o
        catálogo de recompensas. O saldo e o resgate de cada cliente ficam na
        ficha dela.
      </p>

      {/* Config: pontos por indicação */}
      <section className="mb-8 rounded-mi bg-mi-branco p-4 shadow-suave">
        <h2 className="mb-3 font-titulo text-xl text-mi-marrom-escuro">
          Pontos por indicação
        </h2>
        <form action={adminSetPointsPerReferral} className="flex items-end gap-2">
          <label className="text-xs">
            Pontos quando uma indicada faz o 1º atendimento
            <input
              className="input-mi mt-1 w-28 !py-2"
              name="pontos"
              type="number"
              min={0}
              step={1}
              defaultValue={settings.clubPointsPerReferral}
            />
          </label>
          <button className="rounded-mi bg-mi-marrom px-4 py-2 text-sm text-white">
            Salvar
          </button>
        </form>
      </section>

      {/* Catálogo de recompensas */}
      <section className="mb-8">
        <h2 className="mb-3 font-titulo text-xl text-mi-marrom-escuro">
          Catálogo de recompensas
        </h2>

        <details className="mb-4 rounded-mi bg-mi-branco p-4 shadow-suave">
          <summary className="cursor-pointer text-sm text-mi-marrom">
            ＋ Nova recompensa
          </summary>
          <form
            action={adminCreateReward}
            className="mt-3 flex flex-wrap items-end gap-2"
          >
            <label className="text-xs">
              Nome
              <input className="input-mi mt-1 !py-2" name="nome" required />
            </label>
            <label className="text-xs">
              Tipo
              <select className="input-mi mt-1 !py-2" name="tipo">
                <option value="premio">Prêmio</option>
                <option value="servico">Serviço</option>
              </select>
            </label>
            <label className="text-xs">
              Custo (pontos)
              <input
                className="input-mi mt-1 w-24 !py-2"
                name="custoPontos"
                type="number"
                min={1}
                required
              />
            </label>
            <label className="text-xs">
              Ordem
              <input
                className="input-mi mt-1 w-16 !py-2"
                name="sort"
                type="number"
                defaultValue={0}
              />
            </label>
            <button className="rounded-mi bg-mi-marrom px-4 py-2 text-sm text-white">
              Adicionar
            </button>
          </form>
        </details>

        {rewards.length === 0 ? (
          <p className="text-sm text-mi-texto/60">
            Nenhuma recompensa ainda. Crie a primeira acima.
          </p>
        ) : (
          <div className="space-y-2">
            {rewards.map((r) => (
              <div
                key={r.id}
                className="rounded-mi bg-mi-branco p-3 shadow-suave"
              >
                <form
                  action={adminUpdateReward}
                  className="flex flex-wrap items-end gap-2"
                >
                  <input type="hidden" name="id" value={r.id} />
                  <label className="text-xs">
                    Nome
                    <input
                      className="input-mi mt-1 !py-2"
                      name="nome"
                      defaultValue={r.nome}
                      required
                    />
                  </label>
                  <label className="text-xs">
                    Tipo
                    <select
                      className="input-mi mt-1 !py-2"
                      name="tipo"
                      defaultValue={r.tipo}
                    >
                      <option value="premio">Prêmio</option>
                      <option value="servico">Serviço</option>
                    </select>
                  </label>
                  <label className="text-xs">
                    Custo
                    <input
                      className="input-mi mt-1 w-24 !py-2"
                      name="custoPontos"
                      type="number"
                      min={1}
                      defaultValue={r.custoPontos}
                      required
                    />
                  </label>
                  <label className="text-xs">
                    Ordem
                    <input
                      className="input-mi mt-1 w-16 !py-2"
                      name="sort"
                      type="number"
                      defaultValue={r.sort}
                    />
                  </label>
                  <label className="flex items-center gap-1.5 text-xs">
                    <input
                      type="checkbox"
                      name="ativo"
                      defaultChecked={r.ativo}
                    />
                    Ativa
                  </label>
                  <button className="rounded-mi border border-mi-cinza px-3 py-2 text-sm">
                    Salvar
                  </button>
                </form>
                <form
                  action={adminDeleteReward.bind(null, r.id)}
                  className="mt-1"
                >
                  <button className="text-xs text-red-700 underline-offset-2 hover:underline">
                    Excluir
                  </button>
                </form>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Membros com saldo */}
      <section>
        <h2 className="mb-3 font-titulo text-xl text-mi-marrom-escuro">
          Membros ({membrosComSaldo.length})
        </h2>
        {membrosComSaldo.length === 0 ? (
          <p className="text-sm text-mi-texto/60">Nenhum membro ainda.</p>
        ) : (
          <div className="space-y-2">
            {membrosComSaldo.map((m) => (
              <Link
                key={m.id}
                href={`/admin/clientes/${m.id}`}
                className="flex items-center justify-between rounded-mi bg-mi-branco px-4 py-3 shadow-suave hover:bg-mi-cinza/40"
              >
                <span>{m.name}</span>
                <span className="font-medium text-mi-marrom-escuro">
                  {m.saldo} pts
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
