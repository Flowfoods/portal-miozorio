import type { MetadataRoute } from "next";

const BASE =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://miozorio.com.br";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // /indicar e /clube/painel são links pessoais (por código) — fora do índice.
      disallow: ["/admin", "/api", "/indicar", "/clube/painel"],
    },
    sitemap: `${BASE}/sitemap.xml`,
  };
}
