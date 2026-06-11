import type { Metadata } from "next";
import { Cormorant_Garamond, Jost } from "next/font/google";
import "../styles/tokens.css";
import "./globals.css";
import Header from "@/components/site/Header";
import Footer from "@/components/site/Footer";

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

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Milene Ozorio · Beauty Artist · Maquiagem e penteado RJ",
    template: "%s",
  },
  description:
    "Maquiagem e penteado para noivas, debutantes e festas no Rio de Janeiro. Agendamento online com a maquiadora Milene Ozorio.",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "pt_BR",
    siteName: "Mi Ozorio · Beauty Artist",
    url: SITE_URL,
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body className={`${cormorant.variable} ${jost.variable} antialiased`}>
        <Header />
        {children}
        <Footer />
      </body>
    </html>
  );
}
