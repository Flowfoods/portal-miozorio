import { readPrivateAttachment } from "@/lib/media";
import { getAdminSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * Serve anexos PRIVADOS do Financeiro (comprovante/nota — PDF ou imagem).
 * Só admin autenticado; nunca cache público. O middleware já protege /admin/*,
 * e aqui rechecamos a sessão (defesa em profundidade) + trava de path traversal.
 */
export async function GET(
  _req: Request,
  { params }: { params: { path: string[] } },
): Promise<Response> {
  const session = await getAdminSession();
  if (!session?.user?.email) {
    return new Response("Não autorizado", { status: 401 });
  }
  const file = await readPrivateAttachment(params.path.join("/"));
  if (!file) return new Response("Não encontrado", { status: 404 });
  return new Response(new Uint8Array(file.buffer), {
    headers: {
      "Content-Type": file.contentType,
      "Content-Disposition": "inline",
      "Cache-Control": "private, no-store",
    },
  });
}
