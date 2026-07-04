import { prisma } from "@/lib/prisma";
import { readPrivatePhoto } from "@/lib/media";
import { getClienteSession } from "@/lib/cliente-auth";
import { getAdminSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * Serve foto de depoimento com GATE POR STATUS no banco (F3):
 *  - pública SÓ se o depoimento está aprovado + a foto está aprovada +
 *    consentimento registrado (cache curto no edge — revogação em ≤1h lá,
 *    imediata no origin);
 *  - senão: só a DONA (sessão do clube) ou a Mi (sessão admin) — sem cache;
 *  - qualquer outro caso: 404 (não vaza existência).
 * O arquivo vive no store PRIVADO (priv/) — nunca em /media público.
 */
export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
): Promise<Response> {
  const foto = await prisma.testimonialPhoto
    .findUnique({
      where: { id: params.id },
      select: {
        fileKey: true,
        aprovada: true,
        testimonial: {
          select: {
            status: true,
            customerId: true,
            consentimentoPublicoAt: true,
          },
        },
      },
    })
    .catch(() => null); // id fora do formato uuid → 404
  if (!foto) return new Response("Não encontrado", { status: 404 });

  const publica =
    foto.testimonial.status === "aprovado" &&
    foto.aprovada &&
    foto.testimonial.consentimentoPublicoAt !== null;

  if (!publica) {
    const cliente = getClienteSession();
    const dona =
      !!cliente && !cliente.prov && cliente.customerId === foto.testimonial.customerId;
    if (!dona) {
      const admin = await getAdminSession();
      if (!admin?.user?.email) return new Response("Não encontrado", { status: 404 });
    }
  }

  const buf = await readPrivatePhoto(foto.fileKey);
  if (!buf) return new Response("Não encontrado", { status: 404 });

  return new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type": "image/webp",
      "Cache-Control": publica
        ? "public, s-maxage=3600, stale-while-revalidate=600"
        : "private, no-store",
    },
  });
}
