import { readPrivatePhoto } from "@/lib/media";
import { getAdminSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * Serve fotos PRIVADAS (foto de referência da cliente — LGPD). Só admin
 * autenticado; nunca cache público. O middleware já protege /admin/*, e aqui
 * checamos a sessão de novo (defesa em profundidade) e travamos path traversal.
 */
export async function GET(
  _req: Request,
  { params }: { params: { path: string[] } },
): Promise<Response> {
  const session = await getAdminSession();
  if (!session?.user?.email) {
    return new Response("Não autorizado", { status: 401 });
  }
  const buf = await readPrivatePhoto(params.path.join("/"));
  if (!buf) return new Response("Não encontrado", { status: 404 });
  return new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type": "image/webp",
      "Cache-Control": "private, no-store",
    },
  });
}
