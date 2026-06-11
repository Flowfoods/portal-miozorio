import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Painel · Mi Ozorio",
  robots: { index: false, follow: false },
};

export default function AdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <main className="mx-auto min-h-[70vh] w-full max-w-5xl px-4 py-10">
      {children}
    </main>
  );
}
