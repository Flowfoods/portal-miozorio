import { prisma } from "@/lib/prisma";
import { formatBRL } from "@/lib/format";
import FinanceSubnav from "@/components/admin/finance/FinanceSubnav";
import SubmitButton from "@/components/admin/SubmitButton";
import { adminCreateRecurring, adminToggleRecurring } from "../actions";

export const dynamic = "force-dynamic";

export default async function RecorrentesPage() {
  const [categorias, recorrentes] = await Promise.all([
    prisma.financialCategory.findMany({
      where: { kind: "expense", active: true },
      orderBy: { sort: "asc" },
    }),
    prisma.recurringCost.findMany({
      include: { category: true },
      orderBy: { dayOfMonth: "asc" },
    }),
  ]);

  return (
    <>
      <FinanceSubnav />
      <h1 className="mb-1 text-3xl">Custos recorrentes</h1>
      <p className="mb-6 text-sm text-mi-texto/80">
        Modelos de custo fixo (aluguel, internet, contador…). Um job mensal gera
        a despesa do mês automaticamente, sem duplicar.
      </p>

      <details className="mb-6 rounded-mi bg-mi-superficie-elevada p-4 shadow-suave">
        <summary className="cursor-pointer font-corpo text-sm text-mi-marrom-escuro">＋ Novo recorrente</summary>
        <form action={adminCreateRecurring} className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="block sm:col-span-2">
            <span className="mb-1 block text-xs text-mi-texto/80">Categoria</span>
            <select name="categoryId" required className="input-mi" defaultValue="">
              <option value="" disabled>Escolha…</option>
              {categorias.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
          <label className="block sm:col-span-2">
            <span className="mb-1 block text-xs text-mi-texto/80">Descrição</span>
            <input name="description" required className="input-mi" />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs text-mi-texto/80">Valor (R$)</span>
            <input name="amount" required inputMode="decimal" placeholder="0,00" className="input-mi" />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs text-mi-texto/80">Dia de vencimento (1–28)</span>
            <input name="dayOfMonth" type="number" min={1} max={28} required className="input-mi" />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs text-mi-texto/80">Método</span>
            <select name="paymentMethod" className="input-mi" defaultValue="">
              <option value="">—</option>
              <option value="pix">PIX</option>
              <option value="cartao">Cartão</option>
              <option value="dinheiro">Dinheiro</option>
              <option value="boleto">Boleto</option>
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs text-mi-texto/80">Fornecedor (opcional)</span>
            <input name="supplier" className="input-mi" />
          </label>
          <div className="sm:col-span-2">
            <SubmitButton pendingLabel="Salvando…" className="rounded-mi bg-mi-marrom-escuro px-5 py-2.5 text-sm text-white">
              Salvar recorrente
            </SubmitButton>
          </div>
        </form>
      </details>

      <div className="overflow-x-auto rounded-mi bg-mi-superficie-elevada shadow-suave">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-mi-cinza text-left text-xs text-mi-texto/80">
              <th className="px-4 py-3">Dia</th>
              <th className="px-4 py-3">Categoria</th>
              <th className="px-4 py-3">Descrição</th>
              <th className="px-4 py-3 text-right">Valor</th>
              <th className="px-4 py-3">Situação</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {recorrentes.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-mi-texto/80">Nenhum custo recorrente cadastrado.</td></tr>
            )}
            {recorrentes.map((r) => (
              <tr key={r.id} className="border-b border-mi-cinza/60">
                <td className="px-4 py-3 tabular-nums">{r.dayOfMonth}</td>
                <td className="px-4 py-3">{r.category.name}</td>
                <td className="px-4 py-3">{r.description}</td>
                <td className="px-4 py-3 text-right tabular-nums">{formatBRL(r.amountCents)}</td>
                <td className="px-4 py-3">
                  {r.active ? (
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-900">ativo</span>
                  ) : (
                    <span className="text-xs text-mi-texto/80">inativo</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  <form action={adminToggleRecurring.bind(null, r.id)}>
                    <button className="text-xs text-mi-marrom-escuro underline-offset-2 hover:underline">
                      {r.active ? "Desativar" : "Ativar"}
                    </button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
