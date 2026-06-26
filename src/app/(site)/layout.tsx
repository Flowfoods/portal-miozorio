import Header from "@/components/site/Header";
import Footer from "@/components/site/Footer";
import FloatingWhatsApp from "@/components/site/FloatingWhatsApp";

/**
 * Layout do site PÚBLICO (route group `(site)`): Header + Footer + CTA flutuante.
 * Separado do `/admin` (que tem a própria casca, AdminShell) — assim o chrome
 * público nunca vaza para o painel. URLs não mudam (route group é transparente).
 */
export default function SiteLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <Header />
      {children}
      <Footer />
      <FloatingWhatsApp />
    </>
  );
}
