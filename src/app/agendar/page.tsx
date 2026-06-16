import type { Metadata } from "next";
import { Suspense } from "react";
import { pageMeta } from "@/lib/seo";
import AgendarWizard from "@/components/agendar/AgendarWizard";

export const metadata: Metadata = pageMeta({
  path: "/agendar",
  title: "Agendar meu horário · Mi Ozorio",
  description:
    "Agende sua maquiagem ou penteado com a Milene Ozorio. Rápido, fácil e no seu tempo.",
  ogTitle: "Agendar meu horário",
});

export default function AgendarPage() {
  return (
    <main className="min-h-screen">
      <Suspense>
        <AgendarWizard />
      </Suspense>
    </main>
  );
}
