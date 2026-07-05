import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";
import { formatPeriodoExtenso } from "@/lib/periods";
import { periodoDaRequest } from "@/lib/periods-server";
import { MOTIVO_INDICACAO_PCT } from "@/lib/clube-pontos";
import PeriodSelector from "@/components/admin/PeriodSelector";
import ClientesHubNav from "@/components/admin/ClientesHubNav";
import RegraIndicacaoForm from "@/components/admin/RegraIndicacaoForm";
import {
  adminCreateReward,
  adminUpdateReward,
  adminDeleteReward,
  adminSetReferralRule,
  adminSetPointsEngajamento,
  adminMarkVoucherEntregue,
} from "../actions";

export const dynamic = "force-dynamic";

/**
 * Clube por PONTOS (Anexo 1): a Mi configura pontos por indicação, monta o
 * catálogo de recompensas e vê o saldo de cada membro. Pontos por serviço
 * ficam em /admin/servicos; saldo/extrato/resgate por cliente, na ficha.
 */
export default async function AdminClubePage({
  searchParams,
}: {
  searchParams: { periodo?: string; de?: string; ate?: string };
}) {
  const settings = await getSettings();

  // Período global (F4): recorte do MOVIMENTO (pontos/indicações/resgates).
  // Catálogo, config e saldos de membros seguem all-time (são estado, não fluxo).
  const pr = periodoDaRequest("clube", searchParams, {
    fallback: "ultimos30",
    zone: settings.timezone,
  });
  const range = { gte: pr.period.from, lte: pr.period.to };

  const [rewards, membros, saldos, vouchers, emitidos, resgatados, indicacoes, vouchersPeriodo] = await Promise.all([
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
    prisma.clubVoucher.findMany({
      where: { status: "solicitado" },
      include: { customer: { select: { name: true } } },
      orderBy: { createdAt: "asc" },
    }),
    // Movimento do período (índice novo em created_at — F4).
    prisma.clubTransaction.aggregate({
      where: { createdAt: range, pontos: { gt: 0 } },
      _sum: { pontos: true },
    }),
    prisma.clubTransaction.aggregate({
      where: { createdAt: range, tipo: "redemption" },
      _sum: { pontos: true },
    }),
    prisma.clubTransaction.count({
      where: {
        createdAt: range,
        pontos: { gt: 0 },
        tipo: { in: ["referral", MOTIVO_INDICACAO_PCT] },
      },
    }),
    prisma.clubVoucher.count({ where: { createdAt: range } }),
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
        Suas clientes ganham pontos por atendimento (configure em Serviços) e
        por indicação que se concretiza. Aqui você define os pontos por
        indicação e o catálogo de recompensas. O saldo e o resgate de cada
        cliente ficam na ficha dela.
      </p>

      {/* Movimento do período (F4 — período global) */}
      <PeriodSelector
        modulo="clube"
        preset={pr.period.preset}
        deISO={pr.period.deISO}
        ateISO={pr.period.ateISO}
        extenso={formatPeriodoExtenso(pr.period, settings.timezone)}
        error={pr.error}
      />
      <section className="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-mi bg-mi-branco p-4 shadow-suave">
          <p className="text-xs uppercase tracking-wide text-mi-texto/55">Pontos emitidos</p>
          <p className="mt-1 font-titulo text-2xl text-mi-marrom-escuro">
            {emitidos._sum.pontos ?? 0}
          </p>
        </div>
        <div className="rounded-mi bg-mi-branco p-4 shadow-suave">
          <p className="text-xs uppercase tracking-wide text-mi-texto/55">Pontos resgatados</p>
          <p className="mt-1 font-titulo text-2xl text-mi-marrom-escuro">
            {Math.abs(resgatados._sum.pontos ?? 0)}
          </p>
        </div>
        <div className="rounded-mi bg-mi-branco p-4 shadow-suave">
          <p className="text-xs uppercase tracking-wide text-mi-texto/55">Indicações convertidas</p>
          <p className="mt-1 font-titulo text-2xl text-mi-marrom-escuro">{indicacoes}</p>
        </div>
        <div className="rounded-mi bg-mi-branco p-4 shadow-suave">
          <p className="text-xs uppercase tracking-wide text-mi-texto/55">Resgates (vouchers)</p>
          <p className="mt-1 font-titulo text-2xl text-mi-marrom-escuro">{vouchersPeriodo}</p>
        </div>
      </section>

      {/* Resgates a entregar (vouchers self-service do cliente) */}
      <section className="mb-8">
        <h2 className="mb-3 font-titulo text-xl text-mi-marrom-escuro">
          Resgates a entregar{" "}
          {vouchers.length > 0 && (
            <span className="rounded-full bg-amber-100 px-3 py-0.5 text-sm text-amber-900">
              {vouchers.length}
            </span>
          )}
        </h2>
        {vouchers.length === 0 ? (
          <p className="rounded-mi bg-mi-branco p-4 text-sm text-mi-texto/60 shadow-suave">
            Nenhum resgate pendente.
          </p>
        ) : (
          <div className="space-y-2">
            {vouchers.map((v) => (
              <div
                key={v.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-mi bg-mi-branco p-3 shadow-suave"
              >
                <div className="text-sm">
                  <span className="font-medium">{v.customer.name}</span> ·{" "}
                  {v.rewardNome}{" "}
                  <span className="font-mono text-mi-marrom-escuro">
                    {v.codigo}
                  </span>
                  <span className="block text-xs text-mi-texto/55">
                    {v.custoPontos} pontos
                  </span>
                </div>
                <form action={adminMarkVoucherEntregue.bind(null, v.id)}>
                  <button className="rounded-mi bg-mi-marrom px-4 py-2 text-sm text-white">
                    Marcar entregue
                  </button>
                </form>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Config: regra de indicação PERCENTUAL (substitui a pontuação fixa) */}
      <section className="mb-8 rounded-mi bg-mi-branco p-4 shadow-suave">
        <h2 className="mb-1 font-titulo text-xl text-mi-marrom-escuro">
          Indique e ganhe
        </h2>
        <p className="mb-3 text-xs text-mi-texto/60">
          Quando a amiga indicada se cuida com a Mi e pontua, a indicadora ganha
          um percentual dos pontos dela. Vale só para atendimentos futuros —
          nunca recalcula pontos já dados.
        </p>
        <RegraIndicacaoForm
          percentualInicial={settings.clubReferralPercent}
          escopoInicial={settings.clubReferralScope}
          ativoInicial={settings.clubReferralActive}
          action={adminSetReferralRule}
        />
      </section>

      {/* Config: pontos de engajamento (Área da Cliente — F5) */}
      <section className="mb-8 rounded-mi bg-mi-branco p-4 shadow-suave">
        <h2 className="mb-1 font-titulo text-xl text-mi-marrom-escuro">
          Pontos por engajamento
        </h2>
        <p className="mb-3 text-xs text-mi-texto/60">
          Recompense quem conta como foi e quem volta. Deixe em 0 para desligar.
        </p>
        <form
          action={adminSetPointsEngajamento}
          className="flex flex-wrap items-end gap-3"
        >
          <label className="text-xs">
            Depoimento aprovado
            <input
              className="input-mi mt-1 w-24 !py-2"
              name="depoimento"
              type="number"
              min={0}
              step={1}
              defaultValue={settings.clubPointsDepoimento}
            />
          </label>
          <label className="text-xs">
            Cada foto aprovada
            <input
              className="input-mi mt-1 w-24 !py-2"
              name="foto"
              type="number"
              min={0}
              step={1}
              defaultValue={settings.clubPointsFoto}
            />
          </label>
          <label className="text-xs">
            Reagendar pela área
            <input
              className="input-mi mt-1 w-24 !py-2"
              name="reagendamento"
              type="number"
              min={0}
              step={1}
              defaultValue={settings.clubPointsReagendamento}
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
