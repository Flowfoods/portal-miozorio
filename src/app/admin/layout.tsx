import type { Metadata } from "next";
import AdminShell from "@/components/admin/AdminShell";
import { contarMomentosPendentes } from "@/lib/momentos";

export const metadata: Metadata = {
  title: "Painel · Mi Ozorio",
  robots: { index: false, follow: false },
};

// Contagem fresca a cada carga (badge de pendências); a moderação revalida.
export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const pendentes = await contarMomentosPendentes();
  return (
    <AdminShell badges={{ "/admin/depoimentos": pendentes }}>
      {children}
    </AdminShell>
  );
}
