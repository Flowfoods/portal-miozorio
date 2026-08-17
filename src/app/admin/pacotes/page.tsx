import { prisma } from "@/lib/prisma";
import {
  adminCreatePacote,
  adminUpdatePacote,
  adminDeletePacote,
  adminCreateFaq,
  adminUpdateFaq,
  adminDeleteFaq,
} from "../actions";

export const dynamic = "force-dynamic";

const CATEGORIAS = [
  { key: "noiva", label: "Noivas" },
  { key: "debutante", label: "Debutantes" },
] as const;

export default async function AdminPacotesPage() {
  const [pacotes, faqs] = await Promise.all([
    prisma.pacote.findMany({ orderBy: [{ categoria: "asc" }, { sort: "asc" }] }),
    prisma.faq.findMany({ orderBy: [{ categoria: "asc" }, { sort: "asc" }] }),
  ]);

  return (
    <>
      <h1 className="mb-2 text-3xl">Pacotes e perguntas</h1>
      <p className="mb-6 text-sm text-mi-texto/80">
        Pacotes e FAQs das páginas de noiva e debutante. Enquanto uma categoria
        não tiver itens aqui, o site mostra o conteúdo padrão.
      </p>

      {CATEGORIAS.map((cat) => {
        const meusPacotes = pacotes.filter((p) => p.categoria === cat.key);
        const minhasFaqs = faqs.filter((f) => f.categoria === cat.key);
        return (
          <section key={cat.key} className="mb-12">
            <h2 className="mb-4 font-titulo text-2xl text-mi-marrom-escuro">
              {cat.label}
            </h2>

            {/* Pacotes */}
            <h3 className="mb-2 text-sm font-medium text-mi-texto/80">Pacotes</h3>
            <details className="mb-3 rounded-mi bg-mi-branco p-4 shadow-suave">
              <summary className="cursor-pointer text-sm text-mi-marrom-escuro">
                ＋ Novo pacote
              </summary>
              <form action={adminCreatePacote} className="mt-3 space-y-2">
                <input type="hidden" name="categoria" value={cat.key} />
                <div className="flex flex-wrap gap-2">
                  <input name="nome" placeholder="Nome" required className="input-mi !py-2" />
                  <input name="preco" placeholder="R$ 0.000" required className="input-mi !py-2" />
                  <input name="parcela" placeholder="parcelamento (opcional)" className="input-mi !py-2" />
                  <input name="sort" type="number" placeholder="ordem" defaultValue={0} className="input-mi w-20 !py-2" />
                  <label className="flex items-center gap-1 text-xs">
                    <input type="checkbox" name="destaque" /> destaque
                  </label>
                </div>
                <textarea name="itens" rows={4} placeholder="Um item por linha" className="input-mi w-full" />
                <input name="rodape" placeholder="rodapé / cortesia (opcional)" className="input-mi w-full !py-2" />
                <button className="rounded-mi bg-mi-marrom-escuro px-4 py-2 text-sm text-white">Adicionar pacote</button>
              </form>
            </details>
            {meusPacotes.map((p) => (
              <div key={p.id} className="mb-2 rounded-mi bg-mi-branco p-3 shadow-suave">
                <form action={adminUpdatePacote} className="space-y-2">
                  <input type="hidden" name="id" value={p.id} />
                  <div className="flex flex-wrap gap-2">
                    <input name="nome" defaultValue={p.nome} required className="input-mi !py-2" />
                    <input name="preco" defaultValue={p.preco} required className="input-mi !py-2" />
                    <input name="parcela" defaultValue={p.parcela ?? ""} placeholder="parcelamento" className="input-mi !py-2" />
                    <input name="sort" type="number" defaultValue={p.sort} className="input-mi w-20 !py-2" />
                    <label className="flex items-center gap-1 text-xs">
                      <input type="checkbox" name="destaque" defaultChecked={p.destaque} /> destaque
                    </label>
                    <label className="flex items-center gap-1 text-xs">
                      <input type="checkbox" name="ativo" defaultChecked={p.ativo} /> ativo
                    </label>
                  </div>
                  <textarea name="itens" rows={4} defaultValue={p.itens.join("\n")} className="input-mi w-full" />
                  <input name="rodape" defaultValue={p.rodape ?? ""} placeholder="rodapé / cortesia" className="input-mi w-full !py-2" />
                  <button className="rounded-mi border border-mi-cinza px-3 py-2 text-sm">Salvar</button>
                </form>
                <form action={adminDeletePacote.bind(null, p.id)} className="mt-1">
                  <button className="text-xs text-mi-erro-tinta underline-offset-2 hover:underline">Excluir pacote</button>
                </form>
              </div>
            ))}

            {/* FAQs */}
            <h3 className="mb-2 mt-6 text-sm font-medium text-mi-texto/80">Perguntas frequentes</h3>
            <details className="mb-3 rounded-mi bg-mi-branco p-4 shadow-suave">
              <summary className="cursor-pointer text-sm text-mi-marrom-escuro">＋ Nova pergunta</summary>
              <form action={adminCreateFaq} className="mt-3 space-y-2">
                <input type="hidden" name="categoria" value={cat.key} />
                <input name="pergunta" placeholder="Pergunta" required className="input-mi w-full !py-2" />
                <textarea name="resposta" rows={2} placeholder="Resposta" required className="input-mi w-full" />
                <input name="sort" type="number" defaultValue={0} className="input-mi w-20 !py-2" />
                <button className="rounded-mi bg-mi-marrom-escuro px-4 py-2 text-sm text-white">Adicionar pergunta</button>
              </form>
            </details>
            {minhasFaqs.map((f) => (
              <div key={f.id} className="mb-2 rounded-mi bg-mi-branco p-3 shadow-suave">
                <form action={adminUpdateFaq} className="space-y-2">
                  <input type="hidden" name="id" value={f.id} />
                  <input name="pergunta" defaultValue={f.pergunta} required className="input-mi w-full !py-2" />
                  <textarea name="resposta" rows={2} defaultValue={f.resposta} required className="input-mi w-full" />
                  <div className="flex items-center gap-2">
                    <input name="sort" type="number" defaultValue={f.sort} className="input-mi w-20 !py-2" />
                    <label className="flex items-center gap-1 text-xs">
                      <input type="checkbox" name="ativo" defaultChecked={f.ativo} /> ativa
                    </label>
                    <button className="rounded-mi border border-mi-cinza px-3 py-2 text-sm">Salvar</button>
                  </div>
                </form>
                <form action={adminDeleteFaq.bind(null, f.id)} className="mt-1">
                  <button className="text-xs text-mi-erro-tinta underline-offset-2 hover:underline">Excluir pergunta</button>
                </form>
              </div>
            ))}
          </section>
        );
      })}
    </>
  );
}
