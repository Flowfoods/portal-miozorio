import Image from "next/image";
import type { MediaAsset } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import ConfirmForm from "@/components/admin/ConfirmForm";
import UploadFotos from "@/components/admin/UploadFotos";
import {
  MEDIA_CATEGORIES,
  MEDIA_CATEGORY_LABEL as CATEGORY_LABEL,
  type MediaCategory,
} from "@/lib/media-shared";
import {
  adminToggleMediaPublished,
  adminUpdateMediaAlt,
  adminDeleteMedia,
} from "../actions";

export const dynamic = "force-dynamic";

const CATEGORY_HINT: Record<MediaCategory, string> = {
  hero: "A foto principal, na primeira tela do site. A mais recente publicada é a que aparece.",
  sobre: "Seu retrato na página “Sobre a Mi”.",
  portfolio: "A galeria de trabalhos na página inicial.",
  servico: "Fotos que ilustram os serviços (vão aparecer na linha do dia a dia).",
};

function FotoCard({ asset }: { asset: MediaAsset }) {
  return (
    <article className="overflow-hidden rounded-mi bg-mi-branco shadow-suave">
      <div className="relative aspect-[4/5] bg-mi-cinza">
        <Image
          src={asset.url}
          alt={asset.alt}
          fill
          sizes="(max-width: 640px) 50vw, 220px"
          className={`object-cover ${asset.published ? "" : "opacity-40"}`}
        />
        {!asset.published && (
          <span className="absolute left-2 top-2 rounded-mi bg-mi-marrom-escuro/80 px-2 py-0.5 text-xs text-white">
            Oculta
          </span>
        )}
      </div>
      <div className="space-y-2 p-3">
        <form action={adminUpdateMediaAlt} className="flex gap-1.5">
          <input type="hidden" name="id" value={asset.id} />
          <input
            name="alt"
            defaultValue={asset.alt}
            aria-label="Descrição da foto"
            className="input-mi min-w-0 flex-1"
          />
          <button
            type="submit"
            className="rounded-mi border border-mi-cinza px-2 text-xs text-mi-marrom-escuro hover:bg-mi-cinza"
          >
            Salvar
          </button>
        </form>
        <div className="flex items-center justify-between gap-2">
          <form action={adminToggleMediaPublished.bind(null, asset.id)}>
            <button
              type="submit"
              className="min-h-[44px] rounded-mi bg-mi-marrom-escuro px-3 text-xs text-white hover:bg-mi-marrom"
            >
              {asset.published ? "Ocultar do site" : "Publicar no site"}
            </button>
          </form>
          <ConfirmForm
            action={adminDeleteMedia.bind(null, asset.id)}
            message="Excluir essa foto de vez? Ela some do site na hora."
          >
            <button
              type="submit"
              className="min-h-[44px] px-2 text-xs text-red-700 underline-offset-2 hover:underline"
            >
              Excluir
            </button>
          </ConfirmForm>
        </div>
      </div>
    </article>
  );
}

export default async function FotosPage({
  searchParams,
}: {
  searchParams?: { enviadas?: string; pulados?: string; quais?: string };
}) {
  const assets = await prisma.mediaAsset.findMany({
    orderBy: [{ sort: "asc" }, { createdAt: "desc" }],
  });

  const enviadas = Number(searchParams?.enviadas ?? 0) || 0;
  const pulados = Number(searchParams?.pulados ?? 0) || 0;
  const quais = searchParams?.quais?.slice(0, 300) ?? "";

  return (
    <>
      <h1 className="font-titulo text-3xl text-mi-marrom-escuro">Fotos</h1>
      <p className="mt-1 text-sm text-mi-texto/80">
        Suba fotos direto do celular — elas entram no site na hora. Só publique
        fotos de clientes que autorizaram 💛
      </p>

      {(enviadas > 0 || pulados > 0) && (
        <p
          role="status"
          className={`mt-4 rounded-mi px-4 py-3 text-sm ${
            pulados > 0
              ? "bg-amber-50 text-amber-900"
              : "bg-mi-bege text-mi-marrom-escuro"
          }`}
        >
          {enviadas > 0 && (
            <>
              <strong>
                {enviadas} foto{enviadas > 1 ? "s" : ""}
              </strong>{" "}
              {enviadas > 1 ? "entraram" : "entrou"} no site.
            </>
          )}
          {pulados > 0 && (
            <>
              {" "}
              {pulados} não {pulados > 1 ? "deram" : "deu"} certo
              {quais ? `: ${quais}` : ""}
              {pulados > 3 ? " (e outras)" : ""}. Pode reenviar só{" "}
              {pulados > 1 ? "essas" : "essa"}.
            </>
          )}
        </p>
      )}

      {/* Upload (BUG D): foto a foto, com progresso e otimização no celular */}
      <UploadFotos />

      {/* Galeria por categoria */}
      {MEDIA_CATEGORIES.map((c) => {
        const list = assets.filter((a) => a.category === c);
        return (
          <section key={c} className="mt-10">
            <h2 className="font-titulo text-2xl text-mi-marrom-escuro">
              {CATEGORY_LABEL[c]}
            </h2>
            <p className="mt-0.5 text-xs text-mi-texto/80">
              {CATEGORY_HINT[c]}
            </p>
            {list.length === 0 ? (
              <p className="mt-3 rounded-mi border border-dashed border-mi-cinza p-4 text-sm text-mi-texto/80">
                Nenhuma foto aqui ainda.
              </p>
            ) : (
              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                {list.map((a) => (
                  <FotoCard key={a.id} asset={a} />
                ))}
              </div>
            )}
          </section>
        );
      })}
    </>
  );
}
