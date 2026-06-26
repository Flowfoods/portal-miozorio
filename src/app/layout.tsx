import type { Metadata, Viewport } from "next";
import { Cormorant_Garamond, Jost } from "next/font/google";
import "../styles/tokens.css";
import "./globals.css";

const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["500", "600"],
  variable: "--font-titulo",
  display: "swap",
});

const jost = Jost({
  subsets: ["latin"],
  weight: ["300", "400", "500"],
  variable: "--font-corpo",
  display: "swap",
});

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://miozorio.com.br";

export const viewport: Viewport = {
  themeColor: "#8A7361", // marrom da marca — barra do navegador no mobile
};

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Milene Ozorio · Beauty Artist · Maquiagem e penteado RJ",
    template: "%s",
  },
  description:
    "Maquiagem e penteado para noivas, debutantes e festas no Rio de Janeiro. Agendamento online com a maquiadora Milene Ozorio.",
  // ⚠️ SEM canonical aqui (M8.1): seria herdado por TODAS as rotas apontando
  // pra home. Cada página define o seu via pageMeta().
  openGraph: {
    type: "website",
    locale: "pt_BR",
    siteName: "Mi Ozorio · Beauty Artist",
  },
  twitter: { card: "summary_large_image" },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body className={`${cormorant.variable} ${jost.variable} antialiased`}>
        {/* O chrome (Header/Footer público vs. AdminShell) vive nos layouts de
            cada route group — (site) e /admin. O raiz só monta html/body/fontes. */}
        {children}
      </body>
    </html>
  );
}
