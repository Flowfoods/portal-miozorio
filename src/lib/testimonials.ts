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

/** Card da vitrine "Histórias de clientes" (F4) — com foto e serviço. */
export interface VitrineHistoria {
  id: string;
  quote: string;
  author: string; // já abreviado ("Linda S.")
  rating: number | null;
  servico: string | null;
  fotos: { id: string }[]; // servidas por /momentos/foto/<id>
}

/**
 * Vitrine pública (F4): depoimentos APROVADOS de clientes que têm ao menos
 * UMA foto aprovada. Destaque primeiro. Sem fallback — a seção só aparece
 * quando há histórias reais (conteúdo com autorização, R6/LGPD).
 */
export async function getVitrineTestimonials(
  limit = 9,
): Promise<VitrineHistoria[]> {
  try {
    const rows = await prisma.testimonial.findMany({
      where: {
        status: "aprovado",
        published: true,
        origem: "cliente",
        consentimentoPublicoAt: { not: null },
        photos: { some: { aprovada: true } },
      },
      orderBy: [{ destaque: "desc" }, { sort: "asc" }, { moderadoEm: "desc" }],
      take: limit,
      include: {
        booking: { select: { service: { select: { name: true } } } },
        photos: {
          where: { aprovada: true },
          orderBy: { ordem: "asc" },
          select: { id: true },
        },
      },
    });
    return rows.map((r) => ({
      id: r.id,
      quote: r.quote,
      author: r.author,
      rating: r.rating,
      servico: r.booking?.service.name ?? null,
      fotos: r.photos,
    }));
  } catch {
    return [];
  }
}

/** Média + total das notas aprovadas (AggregateRating do schema.org). */
export async function getTestimonialsAggregate(): Promise<{
  media: number;
  total: number;
} | null> {
  try {
    const agg = await prisma.testimonial.aggregate({
      where: { status: "aprovado", published: true, rating: { not: null } },
      _avg: { rating: true },
      _count: { rating: true },
    });
    const total = agg._count.rating;
    const media = agg._avg.rating;
    if (!total || media === null) return null;
    return { media: Math.round(media * 10) / 10, total };
  } catch {
    return null;
  }
}
