import { DateTime } from "luxon";
import { TZ_PADRAO } from "@/lib/periods";
import { prisma } from "@/lib/prisma";
import { formatBRL } from "@/lib/format";
import FinanceSubnav from "@/components/admin/finance/FinanceSubnav";
import SubmitButton from "@/components/admin/SubmitButton";
import ConfirmForm from "@/components/admin/ConfirmForm";
import { adminCreateExpense, adminDeleteExpense } from "../actions";

export const dynamic = "force-dynamic";

const NATURE_LABEL: Record<string, string> = { fixed: "fixo", variable: "variável" };

function mesRange(iso: string) {
  // Default = mês corrente resolvido em SP (fix F3: às 21h de SP o mês não
  // pode "virar" pelo relógio UTC). A fronteira segue UTC (coluna DATE).
  const mesAtualSP = DateTime.now().setZone(TZ_PADRAO).toFormat("yyyy-MM");
  const mes = /^\d{4}-\d{2}$/.test(iso) ? iso : mesAtualSP;
  const base = DateTime.fromISO(`${mes}-01`, { zone: "utc" });
  const start = base.startOf("month");
  return { gte: start.toJSDate(), lt: start.plus({ months: 1 }).toJSDate(), iso: start.toFormat("yyyy-MM") };
}

export default async function CustosPage({
  searchParams,
}: {
  searchParams: { mes?: string; cat?: string };
}) {
  const { gte, lt, iso } = mesRange(searchParams.mes ?? "");
  const catFiltro = searchParams.cat || "";

  const [categorias, despesas] = await Promise.all([
    prisma.financialCategory.findMany({
      where: { kind: "expense", active: true },
      orderBy: { sort: "asc" },
    }),
    prisma.expense.findMany({
      where: {
        active: true,
        competenceDate: { gte, lt },
        ...(catFiltro ? { categoryId: catFiltro } : {}),
      },
      include: { category: true, _count: { select: { attachments: true } } },
      orderBy: { competenceDate: "desc" },
    }),
  ]);

  const total = despesas.reduce((a, d) => a + d.amountCents, 0);

  return (
    <>
      <FinanceSubnav />
      <h1 className="mb-1 text-3xl">Custos</h1>
      <p className="mb-6 text-sm text-mi-texto/80">
        Lance qualquer despesa com comprovante. O total considera a competência
        do mês selecionado.
      </p>

      {/* Lançar custo */}
      <details className="mb-6 rounded-mi bg-mi-superficie-elevada p-4 shadow-suave">
        <summary className="cursor-pointer font-corpo text-sm text-mi-marrom-escuro">＋ Lançar custo</summary>
        <form action={adminCreateExpense} className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="block sm:col-span-2">
            <span className="mb-1 block text-xs text-mi-texto/80">Categoria</span>
            <select name="categoryId" required className="input-mi" defaultValue="">
              <option value="" disabled>Escolha…</option>
              {categorias.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({NATURE_LABEL[c.nature ?? ""] ?? "—"})
                </option>
              ))}
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
            <span className="mb-1 block text-xs text-mi-texto/80">Competência</span>
            <input type="date" name="competenceDate" required className="input-mi" />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs text-mi-texto/80">Pagamento (caixa, opcional)</span>
            <input type="date" name="paidAt" className="input-mi" />
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
          <label className="block">
            <span className="mb-1 block text-xs text-mi-texto/80">Comprovante (PDF/imagem, opcional)</span>
            <input type="file" name="attachment" accept="application/pdf,image/*" className="input-mi !py-2" />
          </label>
          <label className="block sm:col-span-2">
            <span className="mb-1 block text-xs text-mi-texto/80">Observação (opcional)</span>
            <input name="notes" className="input-mi" />
          </label>
          <div className="sm:col-span-2">
            <SubmitButton pendingLabel="Salvando…" className="rounded-mi bg-mi-marrom-escuro px-5 py-2.5 text-sm text-white">
              Salvar custo
            </SubmitButton>
          </div>
        </form>
      </details>

      {/* Filtros */}
      <form className="mb-4 flex flex-wrap items-end gap-3" action="/admin/financeiro/custos">
        <label className="block">
          <span className="mb-1 block text-xs text-mi-texto/80">Mês</span>
          <input type="month" name="mes" defaultValue={iso} className="input-mi !w-auto !py-2" />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs text-mi-texto/80">Categoria</span>
          <select name="cat" defaultValue={catFiltro} className="input-mi !w-auto !py-2">
            <option value="">Todas</option>
            {categorias.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </label>
        <button className="rounded-mi border border-mi-cinza px-4 py-2 text-sm">Filtrar</button>
        <span className="ml-auto self-center text-sm text-mi-texto/80">
          Total do mês: <strong className="text-mi-marrom-escuro">{formatBRL(total)}</strong>
        </span>
      </form>

      {/* Lista */}
      <div className="overflow-x-auto rounded-mi bg-mi-superficie-elevada shadow-suave">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-mi-cinza text-left text-xs text-mi-texto/80">
              <th className="px-4 py-3">Competência</th>
              <th className="px-4 py-3">Categoria</th>
              <th className="px-4 py-3">Descrição</th>
              <th className="px-4 py-3 text-right">Valor</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {despesas.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-mi-texto/80">
                  Nenhum custo neste mês — comece anexando um custo.
                </td>
              </tr>
            )}
            {despesas.map((d) => (
              <tr key={d.id} className="border-b border-mi-cinza/60">
                <td className="px-4 py-3 tabular-nums">
                  {DateTime.fromJSDate(d.competenceDate, { zone: "utc" }).toFormat("dd/LL/yyyy")}
                </td>
                <td className="px-4 py-3">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: d.category.color }} />
                    {d.category.name}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {d.description}
                  {d._count.attachments > 0 && <span title="Tem comprovante" className="ml-1.5 text-mi-marrom">📎</span>}
                </td>
                <td className="px-4 py-3 text-right tabular-nums">{formatBRL(d.amountCents)}</td>
                <td className="px-4 py-3 text-right">
                  <ConfirmForm action={adminDeleteExpense.bind(null, d.id)} message="Remover este custo do histórico?">
                    <button className="text-xs text-red-700 underline-offset-2 hover:underline">Excluir</button>
                  </ConfirmForm>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
