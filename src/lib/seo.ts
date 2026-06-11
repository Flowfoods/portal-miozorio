export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://mileneozorio.com.br";

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
