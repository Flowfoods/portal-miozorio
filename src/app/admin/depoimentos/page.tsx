import Image from "next/image";
import { prisma } from "@/lib/prisma";
import {
  adminCreateTestimonial,
  adminUpdateTestimonial,
  adminToggleTestimonial,
  adminDeleteTestimonial,
  adminAprovarMomento,
  adminRejeitarMomento,
  adminToggleFotoMomento,
  adminToggleDestaqueMomento,
  adminArquivarMomento,
} from "../actions";

export const dynamic = "force-dynamic";

export default async function AdminDepoimentosPage() {
  const [pendentes, items] = await Promise.all([
    prisma.testimonial.findMany({
      where: { status: "pendente" },
      orderBy: { enviadoEm: "asc" },
      include: {
        customer: { select: { name: true } },
        booking: { select: { service: { select: { name: true } } } },
        photos: { orderBy: { ordem: "asc" } },
      },
    }),
    prisma.testimonial.findMany({
      where: { status: { not: "pendente" } },
      orderBy: [{ sort: "asc" }, { createdAt: "desc" }],
      include: { photos: { orderBy: { ordem: "asc" } } },
    }),
  ]);

  return (
    <>
      <h1 className="mb-2 text-3xl">Depoimentos</h1>
      <p className="mb-6 text-sm text-mi-texto/80">
        O que suas clientes falam — aparece na página inicial. Publique só com a
        autorização delas.
      </p>

      {/* ── Fila de moderação (F3) ── */}
      <section className="mb-8">
        <h2 className="flex items-center gap-2 font-titulo text-xl text-mi-marrom-escuro">
          Aguardando você
          {pendentes.length > 0 && (
            <span className="rounded-full bg-mi-marrom-escuro px-2.5 py-0.5 font-corpo text-xs text-mi-branco">
              {pendentes.length}
            </span>
          )}
        </h2>
        {pendentes.length === 0 ? (
          <p className="mt-2 text-sm text-mi-texto/80">
            Nenhum depoimento esperando — quando uma cliente contar um momento,
            ele aparece aqui.
          </p>
        ) : (
          <div className="mt-3 space-y-4">
            {pendentes.map((m) => (
              <div
                key={m.id}
                className="rounded-mi border border-mi-alerta/40 bg-mi-branco p-5 shadow-suave"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="font-corpo text-sm font-medium text-mi-marrom-escuro">
                    {m.customer?.name ?? m.author}
                    {m.booking?.service.name && (
                      <span className="font-normal text-mi-texto/80">
                        {" "}
                        · {m.booking.service.name}
                      </span>
                    )}
                  </p>
                  {m.rating && (
                    <span className="font-corpo text-xs text-mi-marrom-escuro">
                      {"★".repeat(m.rating)}
                      {"☆".repeat(5 - m.rating)}
                    </span>
                  )}
                </div>
                <p className="mt-2 font-titulo text-lg italic text-mi-texto">
                  “{m.quote}”
                </p>

                {m.photos.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-3">
                    {m.photos.map((f) => (
                      <div key={f.id} className="text-center">
                        <Image
                          src={`/momentos/foto/${f.id}`}
                          alt="Foto enviada pela cliente"
                          width={96}
                          height={120}
                          unoptimized
                          className={`h-[120px] w-[96px] rounded-[10px] object-cover ${
                            f.aprovada ? "" : "opacity-40 grayscale"
                          }`}
                        />
                        <form action={adminToggleFotoMomento}>
                          <input type="hidden" name="fotoId" value={f.id} />
                          <button className="mt-1 font-corpo text-xs text-mi-marrom-escuro underline underline-offset-2">
                            {f.aprovada ? "ocultar foto" : "mostrar foto"}
                          </button>
                        </form>
                      </div>
                    ))}
                  </div>
                )}

                <div className="mt-4 flex flex-wrap items-start gap-2 border-t border-mi-cinza/60 pt-3">
                  <form action={adminAprovarMomento}>
                    <input type="hidden" name="id" value={m.id} />
                    <button className="rounded-mi bg-mi-marrom-escuro px-4 py-2 text-sm text-mi-branco transition-colors hover:bg-mi-marrom">
                      Aprovar e publicar
                    </button>
                  </form>
                  <details className="min-w-[220px]">
                    <summary className="cursor-pointer rounded-mi border border-mi-cinza px-4 py-2 text-sm">
                      Não publicar…
                    </summary>
                    <form action={adminRejeitarMomento} className="mt-2 space-y-2">
                      <input type="hidden" name="id" value={m.id} />
                      <textarea
                        name="motivo"
                        rows={2}
                        placeholder="Recado carinhoso pra ela (opcional)"
                        className="input-mi w-full"
                      />
                      <button className="rounded-mi border border-mi-cinza px-3 py-1.5 text-sm">
                        Confirmar
                      </button>
                    </form>
                  </details>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── Cadastro manual (como sempre) ── */}
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
            <button className="self-end rounded-mi bg-mi-marrom-escuro px-4 py-2.5 text-sm text-white">
              Adicionar
            </button>
          </div>
        </form>
      </details>

      {items.length === 0 ? (
        <p className="text-sm text-mi-texto/80">
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
                  className="input-mi w-full"
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
                        ? "bg-mi-sucesso/10 text-mi-sucesso-tinta"
                        : "bg-mi-cinza text-mi-texto/80"
                    }`}
                  >
                    {t.published ? "publicado" : "oculto"}
                  </span>
                  {t.origem === "cliente" && (
                    <span className="rounded-full bg-mi-bege px-3 py-1 text-xs text-mi-marrom-escuro">
                      da cliente
                    </span>
                  )}
                  {t.destaque && (
                    <span className="rounded-full bg-mi-alerta/10 px-3 py-1 text-xs text-mi-alerta-tinta">
                      ★ destaque
                    </span>
                  )}
                </div>
              </form>

              {t.photos.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {t.photos.map((f) => (
                    <div key={f.id} className="text-center">
                      <Image
                        src={`/momentos/foto/${f.id}`}
                        alt="Foto do depoimento"
                        width={64}
                        height={80}
                        unoptimized
                        className={`h-[80px] w-[64px] rounded-[8px] object-cover ${
                          f.aprovada ? "" : "opacity-40 grayscale"
                        }`}
                      />
                      <form action={adminToggleFotoMomento}>
                        <input type="hidden" name="fotoId" value={f.id} />
                        <button className="mt-0.5 font-corpo text-[11px] text-mi-marrom-escuro underline underline-offset-2">
                          {f.aprovada ? "ocultar" : "mostrar"}
                        </button>
                      </form>
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-2 flex flex-wrap gap-2">
                <form action={adminToggleTestimonial.bind(null, t.id)}>
                  <button className="rounded-mi border border-mi-cinza px-3 py-1.5 text-sm">
                    {t.published ? "Ocultar" : "Publicar"}
                  </button>
                </form>
                {t.origem === "cliente" && (
                  <>
                    <form action={adminToggleDestaqueMomento.bind(null, t.id)}>
                      <button className="rounded-mi border border-mi-cinza px-3 py-1.5 text-sm">
                        {t.destaque ? "Tirar destaque" : "Destacar"}
                      </button>
                    </form>
                    {t.status !== "arquivado" && (
                      <form action={adminArquivarMomento.bind(null, t.id)}>
                        <button className="rounded-mi border border-mi-cinza px-3 py-1.5 text-sm">
                          Arquivar
                        </button>
                      </form>
                    )}
                  </>
                )}
                <form action={adminDeleteTestimonial.bind(null, t.id)}>
                  <button className="rounded-mi px-3 py-1.5 text-sm text-mi-erro-tinta underline-offset-4 hover:underline">
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
