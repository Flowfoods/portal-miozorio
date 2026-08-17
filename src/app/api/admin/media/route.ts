import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  deleteMediaFile,
  deleteOriginalFile,
  processUpload,
} from "@/lib/media";
import {
  MAX_UPLOAD_BYTES,
  MEDIA_CATEGORIES,
  formatMB,
  type MediaCategory,
} from "@/lib/media-shared";

/**
 * Upload de foto do site (BUG D — F4). UM arquivo por request, de propósito:
 * o lote inteiro numa server action estourava o body de 25MB e morria com a
 * tela de erro genérica — foi assim que ZERO fotos entraram no ar. Aqui cada
 * foto tem a própria request (progresso real, retry individual, falha parcial
 * não derruba as demais) e o corpo é lido por streaming pelo runtime.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_ALT: Record<MediaCategory, string> = {
  hero: "Maquiagem por Milene Ozorio",
  sobre: "Milene Ozorio no estúdio",
  portfolio: "Produção de beleza por Mi Ozorio",
  servico: "Serviço de beleza por Mi Ozorio",
};

function erro(status: number, message: string) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

export async function POST(req: Request): Promise<NextResponse> {
  try {
    await requireAdmin();
  } catch {
    return erro(401, "Sessão expirada — entre de novo no painel.");
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return erro(400, "Não consegui receber o arquivo. Tente de novo.");
  }

  const category = String(form.get("category") ?? "");
  if (!MEDIA_CATEGORIES.includes(category as MediaCategory)) {
    return erro(400, "Escolha onde a foto vai aparecer.");
  }
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return erro(400, "Escolha uma foto.");
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return erro(
      413,
      `Essa foto tem ${formatMB(file.size)} — o limite é ${formatMB(MAX_UPLOAD_BYTES)}.`,
    );
  }

  let processed;
  try {
    processed = await processUpload(Buffer.from(await file.arrayBuffer()));
  } catch (e) {
    // ENOSPC/EACCES é problema do SERVIDOR (disco cheio, permissão) — dizer
    // "tente em JPG" para uma foto válida mandaria a Mi para um loop inútil.
    const code = (e as NodeJS.ErrnoException)?.code;
    if (typeof code === "string" && code.startsWith("E")) {
      return erro(
        507,
        "Não consegui gravar a foto no servidor — pode ser disco cheio. Avise o suporte.",
      );
    }
    return erro(
      415,
      "Não consegui ler essa foto — tente em JPG, PNG, WebP ou HEIC.",
    );
  }

  const alt = String(form.get("alt") ?? "").trim();
  let asset;
  try {
    asset = await prisma.mediaAsset.create({
      data: {
        url: processed.url,
        origUrl: processed.origUrl,
        width: processed.width,
        height: processed.height,
        blurData: processed.blurData,
        alt: alt || DEFAULT_ALT[category as MediaCategory],
        category,
        published: true,
      },
    });
  } catch {
    // Sem linha no banco, os arquivos seriam órfãos invisíveis no volume.
    await deleteMediaFile(processed.url);
    await deleteOriginalFile(processed.origUrl);
    return erro(500, "Deu um erro ao salvar a foto — tente de novo.");
  }

  revalidatePath("/admin/fotos");
  revalidatePath("/");
  revalidatePath("/sobre");
  revalidatePath("/galeria");

  return NextResponse.json({ ok: true, id: asset.id, url: asset.url });
}
