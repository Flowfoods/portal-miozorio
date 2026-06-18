import type { MetadataRoute } from "next";

/**
 * Web app manifest (Onda F) — "adicionar à tela inicial" no celular, com a
 * identidade da Mi (bege/marrom). Next injeta o <link rel="manifest"> sozinho.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Mi Ozorio · Beauty Artist",
    short_name: "Mi Ozorio",
    description:
      "Maquiagem e penteado para noivas, debutantes e os seus momentos especiais, no Rio de Janeiro.",
    start_url: "/",
    display: "standalone",
    background_color: "#FFFFFF",
    theme_color: "#8A7361",
    lang: "pt-BR",
    icons: [{ src: "/favicon.ico", sizes: "any", type: "image/x-icon" }],
  };
}
