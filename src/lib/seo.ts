import type { Metadata } from "next";

export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://miozorio.com.br";

/**
 * Metadata padrão de página (M8.1): canonical próprio por rota (o layout raiz
 * NÃO define mais canonical — apontava tudo pra home e matava o SEO interno),
 * og:image dinâmico 1200×630 e twitter card.
 */
export function pageMeta(opts: {
  /** Caminho canônico da rota, ex.: "/noivas" */
  path: string;
  title: string;
  description: string;
  /** Título curto exibido DENTRO da og:image (default: title até o 1º "·") */
  ogTitle?: string;
}): Metadata {
  const ogTitle = opts.ogTitle ?? opts.title.split("·")[0]!.trim();
  const ogImage = `/api/og?t=${encodeURIComponent(ogTitle)}`;
  return {
    title: opts.title,
    description: opts.description,
    alternates: { canonical: opts.path },
    openGraph: {
      url: opts.path,
      title: opts.title,
      description: opts.description,
      images: [{ url: ogImage, width: 1200, height: 630, alt: opts.title }],
    },
    twitter: {
      card: "summary_large_image",
      title: opts.title,
      description: opts.description,
      images: [ogImage],
    },
  };
}

const offer = (name: string, priceCents: number) => ({
  "@type": "Offer",
  itemOffered: { "@type": "Service", name },
  price: (priceCents / 100).toFixed(2),
  priceCurrency: "BRL",
});

// JSON-LD da home — negócio local (Google Maps / Search).
export const beautySalonSchema: Record<string, unknown> = {
  "@context": "https://schema.org",
  "@type": "BeautySalon",
  name: "Mi Ozorio · Beauty Artist",
  description:
    "Maquiagem e penteado para noivas, debutantes e festas no Rio de Janeiro, com a maquiadora Milene Ozorio.",
  url: SITE_URL,
  telephone: "+5521970225231",
  priceRange: "R$$",
  currenciesAccepted: "BRL",
  paymentAccepted: "PIX, Cartão de crédito, Dinheiro",
  address: {
    "@type": "PostalAddress",
    streetAddress: "Rua Ipoméia, 5 — Vila Maria",
    addressLocality: "Santíssimo",
    addressRegion: "RJ",
    postalCode: "23560-000",
    addressCountry: "BR",
  },
  geo: {
    "@type": "GeoCoordinates",
    latitude: -22.8758,
    longitude: -43.5092,
  },
  openingHoursSpecification: [
    {
      "@type": "OpeningHoursSpecification",
      dayOfWeek: ["Saturday", "Sunday"],
      opens: "09:00",
      closes: "19:00",
    },
  ],
  sameAs: [
    "https://instagram.com/mileneozorio",
    "https://facebook.com/mileneozorio",
  ],
  areaServed: { "@type": "City", name: "Rio de Janeiro" },
  makesOffer: [
    offer("Maquiagem social", 25000),
    offer("Penteado", 35000),
    offer("Pacote completo (maquiagem + penteado)", 55000),
    offer("Curso de automaquiagem", 28000),
  ],
};

/**
 * Reviews de clientes (F4) para rich snippet — AggregateRating + Review
 * anexados ao negócio. Só notas reais aprovadas (sem inflar). Retorna null
 * quando não há avaliações (não emite schema vazio).
 */
export function reviewSchema(
  aggregate: { media: number; total: number } | null,
  reviews: { autor: string; nota: number | null; texto: string }[],
): Record<string, unknown> | null {
  const comNota = reviews.filter((r) => r.nota !== null);
  if (!aggregate && comNota.length === 0) return null;
  const schema: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "BeautySalon",
    name: "Mi Ozorio · Beauty Artist",
    url: SITE_URL,
  };
  if (aggregate) {
    schema.aggregateRating = {
      "@type": "AggregateRating",
      ratingValue: aggregate.media,
      reviewCount: aggregate.total,
      bestRating: 5,
      worstRating: 1,
    };
  }
  if (comNota.length > 0) {
    schema.review = comNota.slice(0, 10).map((r) => ({
      "@type": "Review",
      author: { "@type": "Person", name: r.autor },
      reviewRating: {
        "@type": "Rating",
        ratingValue: r.nota,
        bestRating: 5,
        worstRating: 1,
      },
      reviewBody: r.texto,
    }));
  }
  return schema;
}

export function faqSchema(
  items: { q: string; a: string }[],
): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((i) => ({
      "@type": "Question",
      name: i.q,
      acceptedAnswer: { "@type": "Answer", text: i.a },
    })),
  };
}
