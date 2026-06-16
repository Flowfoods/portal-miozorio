import { prisma } from "./prisma";

/**
 * Depoimentos (M12). A Mi cadastra os reais no /admin; enquanto não houver
 * nenhum publicado, o site cai nos ilustrativos (nunca fica vazio). Sem banco
 * (build) também devolve o fallback — mesmo padrão de getPublishedMedia.
 */

export interface Depoimento {
  quote: string;
  author: string;
}

/** Ilustrativos — substituídos assim que a Mi publicar reais (Anexo A). */
export const FALLBACK_TESTIMONIALS: Depoimento[] = [
  {
    quote:
      "A Mi entendeu exatamente o que eu queria. Me senti a versão mais bonita de mim mesma.",
    author: "Ana · madrinha",
  },
  {
    quote:
      "Maquiagem impecável o dia inteiro, mesmo com calor e emoção. Recomendo de olhos fechados.",
    author: "Carol · formanda",
  },
  {
    quote:
      "Cuidado, carinho e um resultado de tirar o fôlego. Já virou minha maquiadora oficial.",
    author: "Bia · noiva",
  },
];

export async function getPublishedTestimonials(
  limit?: number,
): Promise<Depoimento[]> {
  try {
    const rows = await prisma.testimonial.findMany({
      where: { published: true },
      orderBy: [{ sort: "asc" }, { createdAt: "desc" }],
      ...(limit ? { take: limit } : {}),
    });
    if (rows.length === 0) return FALLBACK_TESTIMONIALS;
    return rows.map((r) => ({ quote: r.quote, author: r.author }));
  } catch {
    return FALLBACK_TESTIMONIALS;
  }
}
