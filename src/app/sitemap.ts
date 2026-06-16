import type { MetadataRoute } from "next";

const BASE =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://miozorio.com.br";

export default function sitemap(): MetadataRoute.Sitemap {
  const routes = [
    "",
    "/agendar",
    "/dia-a-dia",
    "/noivas",
    "/debutantes",
    "/clube",
    "/sobre",
    "/privacidade",
  ];
  return routes.map((r) => ({
    url: `${BASE}${r}`,
    lastModified: new Date(),
    changeFrequency: "monthly",
    priority: r === "" ? 1 : 0.8,
  }));
}
