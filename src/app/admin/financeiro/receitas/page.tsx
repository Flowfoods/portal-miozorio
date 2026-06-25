import Link from "next/link";
import { DateTime } from "luxon";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";
import { formatBRL } from "@/lib/format";
import FinanceSubnav from "@/components/admin/finance/FinanceSubnav";
import SubmitButton from "@/components/admin/SubmitButton";
import ConfirmForm from "@/components/admin/ConfirmForm";
import { adminCreateRevenue, adminDeleteRevenue } from "../actions";

export const dynamic = "force-dynamic";

function mesRange(iso: string) {
  const base = /^\d{4}-\d{2}$/.test(iso) ? DateTime.fromISO(`${iso}-01`, { zone: "utc" }) : DateTime.utc();
  const start = base.startOf("month");
  return { gte: start.toJSDate(), lt: start.plus({ months: 1 }).toJSDate(), iso: start.toFormat("yyyy-MM") };
}

export default async function ReceitasPage({
  searchParams,
}: {
  searchParams: { mes?: string };
}) {
  const { gte, lt, iso } = mesRange(searchParams.mes ?? "");
  const { timezone: tz } = await getSettings();

  const [categorias, manuais, doAgendamento] = await Promise.all([
    prisma.financialCategory.findMany({
      where: { kind: "revenue", active: true },
      orderBy: { sort: "asc" },
    }),
    prisma.revenueEntry.findMany({
      where: { active: true, source: "manual", competenceDate: { gte, lt } },
      include: { category: true, _count: { select: { attachments: true } } },
      orderBy: { competenceDate: "desc" },
    }),
    prisma.revenueEntry.findMany({
      where: { active: true, source: "booking", competenceDate: { gte, lt } },
      include: { category: true, booking: { select: { id: true, startsAt: true } } },
      orderBy: { competenceDate: "desc" },
    }),
  ]);

  const totalManual = manuais.reduce((a, r) => a + r.amountCents, 0);
  const totalBooking = doAgendamento.reduce((a, r) => a + r.amountCents, 0);

  return (
    <>
      <FinanceSubnav />
      <h1 className="mb-1 text-3xl">Receitas</h1>
      <p className="mb-6 text-sm text-mi-texto/70">
        Receita de agendamento entra sozinha quando você conclui o atendimento.
        Use o formulário para noiva, debutante, curso e vendas avulsas.
      </p>

      {/* Lançar receita manual */}
      <details className="mb-6 rounded-mi bg-mi-superficie-elevada p-4 shadow-suave">
        <summary className="cursor-pointer font-corpo text-sm text-mi-marrom">＋ Lançar receita manual</summary>
        <form action={adminCreateRevenue} className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="block sm:col-span-2">
            <span className="mb-1 block text-xs text-mi-texto/60">Categoria</span>
            <select name="categoryId" className="input-mi" defaultValue="">
              <option value="">— (sem categoria)</option>
              {categorias.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </label>
          <label className="block sm:col-span-2">
            <span className="mb-1 block text-xs text-mi-texto/60">Descrição (ex.: Noiva — sinal)</span>
            <input name="description" required className="input-mi" />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs text-mi-texto/60">Valor (R$)</span>
            <input name="amount" required inputMode="decimal" placeholder="0,00" className="input-mi" />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs text-mi-texto/60">Data do evento (competência)</span>
            <input type="date" name="competenceDate" required className="input-mi" />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs text-mi-texto/60">Recebimento (caixa, opcional)</span>
            <input type="date" name="receivedAt" className="input-mi" />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs text-mi-texto/60">Cliente (opcional)</span>
            <input name="customerName" className="input-mi" />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs text-mi-texto/60">Método</span>
            <select name="paymentMethod" className="input-mi" defaultValue="">
              <option value="">—</option>
              <option value="pix">PIX</option>
              <option value="cartao">Cartão</option>
              <option value="dinheiro">Dinheiro</option>
              <option value="boleto">Boleto</option>
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs text-mi-texto/60">Taxa de cartão (R$, opcional)</span>
            <input name="cardFee" inputMode="decimal" placeholder="0,00" className="input-mi" />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs text-mi-texto/60">Comprovante (PDF/imagem, opcional)</span>
            <input type="file" name="attachment" accept="application/pdf,image/*" className="input-mi !py-2" />
          </label>
          <div className="sm:col-span-2">
            <SubmitButton pendingLabel="Salvando…" className="rounded-mi bg-mi-marrom px-5 py-2.5 text-sm text-white">
              Salvar receita
            </SubmitButton>
          </div>
        </form>
      </details>

      {/* Filtro mês */}
      <form className="mb-4 flex flex-wrap items-end gap-3" action="/admin/financeiro/receitas">
        <label className="block">
          <span className="mb-1 block text-xs text-mi-texto/60">Mês</span>
          <input type="month" name="mes" defaultValue={iso} className="input-mi !w-auto !py-2" />
        </label>
        <button className="rounded-mi border border-mi-cinza px-4 py-2 text-sm">Filtrar</button>
      </form>

      {/* Manuais */}
      <h2 className="mb-2 mt-2 text-xl">
        Lançamentos manuais
        <span className="ml-2 text-sm font-normal text-mi-texto/60">{formatBRL(totalManual)}</span>
      </h2>
      <div className="mb-8 overflow-x-auto rounded-mi bg-mi-superficie-elevada shadow-suave">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-mi-cinza text-left text-xs text-mi-texto/60">
              <th className="px-4 py-3">Competência</th>
              <th className="px-4 py-3">Categoria</th>
              <th className="px-4 py-3">Descrição</th>
              <th className="px-4 py-3 text-right">Valor</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {manuais.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-mi-texto/55">Nenhuma receita manual neste mês.</td></tr>
            )}
            {manuais.map((r) => (
              <tr key={r.id} className="border-b border-mi-cinza/60">
                <td className="px-4 py-3 tabular-nums">{DateTime.fromJSDate(r.competenceDate, { zone: "utc" }).toFormat("dd/LL/yyyy")}</td>
                <td className="px-4 py-3">{r.category?.name ?? "—"}</td>
                <td className="px-4 py-3">
                  {r.description}
                  {r._count.attachments > 0 && <span title="Tem comprovante" className="ml-1.5 text-mi-marrom">📎</span>}
                </td>
                <td className="px-4 py-3 text-right tabular-nums">{formatBRL(r.amountCents)}</td>
                <td className="px-4 py-3 text-right">
                  <ConfirmForm action={adminDeleteRevenue.bind(null, r.id)} message="Remover esta receita do histórico?">
                    <button className="text-xs text-red-700 underline-offset-2 hover:underline">Excluir</button>
                  </ConfirmForm>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Vindas do agendamento (só leitura) */}
      <h2 className="mb-2 text-xl">
        Vindas do agendamento
        <span className="ml-2 text-sm font-normal text-mi-texto/60">{formatBRL(totalBooking)}</span>
      </h2>
      <div className="overflow-x-auto rounded-mi bg-mi-superficie-elevada shadow-suave">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-mi-cinza text-left text-xs text-mi-texto/60">
              <th className="px-4 py-3">Competência</th>
              <th className="px-4 py-3">Categoria</th>
              <th className="px-4 py-3">Cliente</th>
              <th className="px-4 py-3 text-right">Valor</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {doAgendamento.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-mi-texto/55">Nenhum atendimento concluído reconhecido neste mês.</td></tr>
            )}
            {doAgendamento.map((r) => {
              const iso2 = r.booking
                ? DateTime.fromJSDate(r.booking.startsAt).setZone(tz).toISODate()
                : null;
              return (
                <tr key={r.id} className="border-b border-mi-cinza/60">
                  <td className="px-4 py-3 tabular-nums">{DateTime.fromJSDate(r.competenceDate, { zone: "utc" }).toFormat("dd/LL/yyyy")}</td>
                  <td className="px-4 py-3">{r.category?.name ?? "—"}</td>
                  <td className="px-4 py-3">{r.customerName ?? "—"}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{formatBRL(r.amountCents)}</td>
                  <td className="px-4 py-3 text-right">
                    {r.booking && iso2 && (
                      <Link href={`/admin?data=${iso2}#b-${r.booking.id}`} className="text-xs text-mi-marrom underline-offset-2 hover:underline">
                        ver agenda
                      </Link>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
