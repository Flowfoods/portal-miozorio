import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";

// og:image dinâmico (M8.1). Route handler em runtime — NÃO usar arquivo
// opengraph-image.tsx: o prerender dele quebrava o build standalone (lição M6).
export const dynamic = "force-dynamic";

// Cormorant Garamond buscada 1x por processo; sem rede, cai na fonte padrão.
let cormorant: ArrayBuffer | null = null;
async function loadFont(): Promise<ArrayBuffer | null> {
  if (cormorant) return cormorant;
  try {
    const css = await fetch(
      "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@600",
      { headers: { "User-Agent": "Mozilla/5.0" } },
    ).then((r) => r.text());
    const url = css.match(/src: url\((.+?)\)/)?.[1];
    if (url) cormorant = await fetch(url).then((r) => r.arrayBuffer());
  } catch {
    // sem internet no build/boot: segue com a fonte embutida
  }
  return cormorant;
}

export async function GET(req: NextRequest) {
  const title = (req.nextUrl.searchParams.get("t") ?? "Mi Ozorio").slice(0, 60);
  const font = await loadFont();

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#F5F0E8",
          fontFamily: font ? "Cormorant" : "serif",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 28,
            left: 28,
            right: 28,
            bottom: 28,
            border: "1px solid #8A7361",
            display: "flex",
          }}
        />
        <div style={{ fontSize: 96, color: "#8A7361", display: "flex" }}>
          Mi
        </div>
        <div
          style={{
            fontSize: 54,
            color: "#5C4A3D",
            marginTop: 12,
            maxWidth: 1000,
            textAlign: "center",
            display: "flex",
          }}
        >
          {title}
        </div>
        <div
          style={{
            fontSize: 22,
            color: "#8A7361",
            letterSpacing: 8,
            marginTop: 28,
            display: "flex",
          }}
        >
          MILENE OZORIO · BEAUTY ARTIST
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      headers: { "Cache-Control": "public, max-age=86400" },
      ...(font
        ? { fonts: [{ name: "Cormorant", data: font, weight: 600 as const }] }
        : {}),
    },
  );
}
