import { readFile } from "node:fs/promises";
import path from "node:path";
import { MEDIA_DIR } from "@/lib/media";

/**
 * Serve as fotos do volume persistente (M8.4). Nome de arquivo é único por
 * upload e nunca muda de conteúdo → cache imutável de 1 ano.
 */
export async function GET(
  _req: Request,
  { params }: { params: { path: string[] } },
): Promise<Response> {
  const file = path.normalize(path.join(MEDIA_DIR, ...params.path));
  // Trava de path traversal + só servimos o que nós mesmos geramos (.webp).
  if (
    !file.startsWith(path.normalize(MEDIA_DIR) + path.sep) ||
    !file.endsWith(".webp")
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
