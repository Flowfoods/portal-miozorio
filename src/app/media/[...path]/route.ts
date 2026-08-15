import { readFile } from "node:fs/promises";
import path from "node:path";
import { MEDIA_DIR, PRIVATE_MEDIA_DIR } from "@/lib/media";
import { podeServirPublicamente } from "@/lib/media-path";

/**
 * Serve as fotos do volume persistente (M8.4). Nome de arquivo é único por
 * upload e nunca muda de conteúdo → cache imutável de 1 ano.
 */
export async function GET(
  _req: Request,
  { params }: { params: { path: string[] } },
): Promise<Response> {
  const file = path.normalize(path.join(MEDIA_DIR, ...params.path));
  // Traversal, extensão e store privado — regra única e testada.
  if (
    !podeServirPublicamente({
      mediaDir: MEDIA_DIR,
      privateDir: PRIVATE_MEDIA_DIR,
      segments: params.path,
    })
  ) {
    return new Response("Não encontrado", { status: 404 });
  }
  try {
    const buf = await readFile(file);
    return new Response(new Uint8Array(buf), {
      headers: {
        "Content-Type": "image/webp",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return new Response("Não encontrado", { status: 404 });
  }
}
