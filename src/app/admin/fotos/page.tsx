import Image from "next/image";
import type { MediaAsset } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import SubmitButton from "@/components/admin/SubmitButton";
import ConfirmForm from "@/components/admin/ConfirmForm";
import { MEDIA_CATEGORIES, type MediaCategory } from "@/lib/media";
import {
  adminUploadMedia,
  adminToggleMediaPublished,
  adminUpdateMediaAlt,
  adminDeleteMedia,
} from "../actions";

export const dynamic = "force-dynamic";

const CATEGORY_LABEL: Record<MediaCategory, string> = {
  hero: "Topo do site",
  sobre: "Página Sobre",
  portfolio: "Portfólio",
  servico: "Serviços",
};

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

export default async function FotosPage() {
  const assets = await prisma.mediaAsset.findMany({
    orderBy: [{ sort: "asc" }, { createdAt: "desc" }],
  });

  return (
    <>
      <h1 className="font-titulo text-3xl text-mi-marrom-escuro">Fotos</h1>
      <p className="mt-1 text-sm text-mi-texto/80">
        Suba fotos direto do celular — elas entram no site na hora. Só publique
        fotos de clientes que autorizaram 💛
      </p>

      {/* Upload */}
      <form
        action={adminUploadMedia}
        className="mt-6 space-y-3 rounded-mi bg-mi-branco p-4 shadow-suave"
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="text-mi-texto">Onde a foto vai aparecer</span>
            <select name="category" className="input-mi mt-1 w-full" required>
              {MEDIA_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {CATEGORY_LABEL[c]}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="text-mi-texto">
              Descrição (opcional — ajuda o Google)
            </span>
            <input
              name="alt"
              placeholder="Ex.: Maquiagem de madrinha pele negra"
              className="input-mi mt-1 w-full"
            />
          </label>
        </div>
        <label className="block text-sm">
          <span className="text-mi-texto">Fotos (pode escolher várias)</span>
          <input
            type="file"
            name="files"
            accept="image/*"
            multiple
            required
            className="mt-1 block w-full text-sm text-mi-texto file:mr-3 file:rounded-mi file:border-0 file:bg-mi-cinza file:px-4 file:py-2.5 file:font-corpo file:text-sm file:text-mi-marrom-escuro"
          />
        </label>
        <SubmitButton
          pendingLabel="Enviando… 💛"
          className="min-h-[48px] w-full rounded-mi bg-mi-marrom-escuro px-6 text-sm text-white hover:bg-mi-marrom disabled:opacity-60 sm:w-auto"
        >
          Enviar fotos
        </SubmitButton>
      </form>

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
