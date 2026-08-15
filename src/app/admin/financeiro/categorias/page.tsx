import { prisma } from "@/lib/prisma";
import FinanceSubnav from "@/components/admin/finance/FinanceSubnav";
import SubmitButton from "@/components/admin/SubmitButton";
import { adminCreateCategory, adminUpdateCategory } from "../actions";

export const dynamic = "force-dynamic";

const DRE_OPTS = [
  { v: "deducao_venda", l: "Dedução sobre venda" },
  { v: "custo_variavel", l: "Custo variável" },
  { v: "custo_fixo", l: "Custo fixo" },
  { v: "pro_labore", l: "Pró-labore" },
];

export default async function CategoriasPage() {
  const categorias = await prisma.financialCategory.findMany({
    orderBy: [{ kind: "asc" }, { sort: "asc" }],
  });
  const receita = categorias.filter((c) => c.kind === "revenue");
  const despesa = categorias.filter((c) => c.kind === "expense");

  return (
    <>
      <FinanceSubnav />
      <h1 className="mb-1 text-3xl">Categorias</h1>
      <p className="mb-6 text-sm text-mi-texto/70">
        As categorias organizam o DRE e os gráficos. As padrão já vêm prontas —
        crie mais se precisar.
      </p>

      <details className="mb-8 rounded-mi bg-mi-superficie-elevada p-4 shadow-suave">
        <summary className="cursor-pointer font-corpo text-sm text-mi-marrom">＋ Nova categoria</summary>
        <form action={adminCreateCategory} className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-xs text-mi-texto/60">Nome</span>
            <input name="name" required className="input-mi" />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs text-mi-texto/60">Tipo</span>
            <select name="kind" className="input-mi" defaultValue="expense">
              <option value="expense">Despesa</option>
              <option value="revenue">Receita</option>
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs text-mi-texto/60">Natureza (despesa)</span>
            <select name="nature" className="input-mi" defaultValue="variable">
              <option value="variable">Variável</option>
              <option value="fixed">Fixo</option>
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs text-mi-texto/60">Linha do DRE (despesa)</span>
            <select name="dreGroup" className="input-mi" defaultValue="custo_variavel">
              {DRE_OPTS.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="isCmv" /> Conta como CMV (insumo)
          </label>
          <label className="block">
            <span className="mb-1 block text-xs text-mi-texto/60">Cor</span>
            <input type="color" name="color" defaultValue="#8A7361" className="input-mi !h-10 !py-1" />
          </label>
          <div className="sm:col-span-2">
            <SubmitButton pendingLabel="Salvando…" className="rounded-mi bg-mi-marrom px-5 py-2.5 text-sm text-white">
              Criar categoria
            </SubmitButton>
          </div>
        </form>
      </details>

      <Grupo titulo="Receita" itens={receita} />
      <Grupo titulo="Despesa" itens={despesa} />
    </>
  );
}

function Grupo({
  titulo,
  itens,
}: {
  titulo: string;
  itens: Awaited<ReturnType<typeof prisma.financialCategory.findMany>>;
}) {
  return (
    <section className="mb-8">
      <h2 className="mb-3 text-xl">{titulo}</h2>
      <div className="space-y-2">
        {itens.map((c) => (
          <form
            key={c.id}
            action={adminUpdateCategory}
            className="flex flex-wrap items-center gap-2 rounded-mi bg-mi-superficie-elevada p-3 shadow-suave"
          >
            <input type="hidden" name="id" value={c.id} />
            <input type="color" name="color" defaultValue={c.color} className="h-8 w-8 rounded" aria-label="Cor" />
            <input name="name" defaultValue={c.name} className="input-mi !w-auto flex-1 !py-2" />
            {c.kind === "expense" && (
              <>
                <select name="nature" defaultValue={c.nature ?? "variable"} className="input-mi !w-auto !py-2">
                  <option value="variable">Variável</option>
                  <option value="fixed">Fixo</option>
                </select>
                <select name="dreGroup" defaultValue={c.dreGroup ?? "custo_variavel"} className="input-mi !w-auto !py-2">
                  {DRE_OPTS.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
                </select>
                <label className="flex items-center gap-1 text-xs">
                  <input type="checkbox" name="isCmv" defaultChecked={c.isCmv} /> CMV
                </label>
              </>
            )}
            <label className="flex items-center gap-1 text-xs">
              <input type="checkbox" name="active" defaultChecked={c.active} /> Ativa
            </label>
            <button className="rounded-mi border border-mi-cinza px-3 py-2 text-sm">Salvar</button>
          </form>
        ))}
      </div>
    </section>
  );
}
