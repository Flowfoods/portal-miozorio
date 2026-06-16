import { prisma } from "@/lib/prisma";
import AdminNav from "@/components/admin/AdminNav";
import {
  adminCreateTestimonial,
  adminUpdateTestimonial,
  adminToggleTestimonial,
  adminDeleteTestimonial,
} from "../actions";

export const dynamic = "force-dynamic";

export default async function AdminDepoimentosPage() {
  const items = await prisma.testimonial.findMany({
    orderBy: [{ sort: "asc" }, { createdAt: "desc" }],
  });

  return (
    <>
      <AdminNav />
      <h1 className="mb-2 text-3xl">Depoimentos</h1>
      <p className="mb-6 text-sm text-mi-texto/70">
        O que suas clientes falam — aparece na página inicial. Publique só com a
        autorização delas. Enquanto não houver nenhum publicado, o site mostra
        exemplos.
      </p>

      <details className="mb-6 rounded-mi bg-mi-branco p-4 shadow-suave">
        <summary className="cursor-pointer font-titulo text-lg text-mi-marrom-escuro">
          ＋ Novo depoimento
        </summary>
        <form action={adminCreateTestimonial} className="mt-4 space-y-3">
          <label className="block text-xs">
            Depoimento
            <textarea
              name="quote"
              required
              rows={3}
              className="input-mi mt-1 w-full"
            />
          </label>
          <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto]">
            <label className="text-xs">
              Quem disse
              <input
                name="author"
                required
                placeholder="Ana · madrinha"
                className="input-mi mt-1 !py-2"
              />
            </label>
            <label className="text-xs">
              Ordem
              <input
                name="sort"
                type="number"
                defaultValue={0}
                className="input-mi mt-1 w-20 !py-2"
              />
            </label>
            <button className="self-end rounded-mi bg-mi-marrom px-4 py-2.5 text-sm text-white">
              Adicionar
            </button>
          </div>
        </form>
      </details>

      {items.length === 0 ? (
        <p className="text-sm text-mi-texto/60">
          Nenhum depoimento cadastrado. O site está mostrando exemplos
          ilustrativos.
        </p>
      ) : (
        <div className="space-y-3">
          {items.map((t) => (
            <div key={t.id} className="rounded-mi bg-mi-branco p-4 shadow-suave">
              <form
                action={adminUpdateTestimonial}
                className="space-y-2"
              >
                <input type="hidden" name="id" value={t.id} />
                <textarea
                  name="quote"
                  defaultValue={t.quote}
                  rows={2}
                  required
                  className="input-mi w-full text-sm"
                />
                <div className="flex flex-wrap items-end gap-2">
                  <label className="text-xs">
                    Quem disse
                    <input
                      name="author"
                      defaultValue={t.author}
                      required
                      className="input-mi mt-1 !py-2"
                    />
                  </label>
                  <label className="text-xs">
                    Ordem
                    <input
                      name="sort"
                      type="number"
                      defaultValue={t.sort}
                      className="input-mi mt-1 w-20 !py-2"
                    />
                  </label>
                  <button className="rounded-mi border border-mi-cinza px-3 py-2 text-sm">
                    Salvar
                  </button>
                  <span
                    className={`rounded-full px-3 py-1 text-xs ${
                      t.published
                        ? "bg-emerald-100 text-emerald-900"
                        : "bg-mi-cinza text-mi-texto/70"
                    }`}
                  >
                    {t.published ? "publicado" : "oculto"}
                  </span>
                </div>
              </form>
              <div className="mt-2 flex gap-2">
                <form action={adminToggleTestimonial.bind(null, t.id)}>
                  <button className="rounded-mi border border-mi-cinza px-3 py-1.5 text-sm">
                    {t.published ? "Ocultar" : "Publicar"}
                  </button>
                </form>
                <form action={adminDeleteTestimonial.bind(null, t.id)}>
                  <button className="rounded-mi px-3 py-1.5 text-sm text-red-700 underline-offset-4 hover:underline">
                    Excluir
                  </button>
                </form>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
