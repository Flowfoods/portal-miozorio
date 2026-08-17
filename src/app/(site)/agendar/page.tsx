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
    <main className="min-h-dvh">
      {/* O wizard é client component e usa useSearchParams: o Next desiste do
          SSR na fronteira mais próxima. Sem fallback, o <main> era servido
          vazio e a cliente via branco até o JS hidratar — num Android médio em
          4G, na página que gera receita. */}
      <Suspense fallback={<AgendarEsqueleto />}>
        <AgendarWizard />
      </Suspense>
    </main>
  );
}

function AgendarEsqueleto() {
  return (
    <div className="mx-auto max-w-lg px-5 pb-24 pt-12" aria-hidden>
      <div className="h-3 w-40 animate-pulse rounded-full bg-mi-cinza" />
      <div className="mt-4 h-9 w-64 animate-pulse rounded-mi bg-mi-cinza" />
      <div className="mt-8 space-y-3">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-20 animate-pulse rounded-mi bg-mi-cinza/70"
            style={{ animationDelay: `${i * 80}ms` }}
          />
        ))}
      </div>
    </div>
  );
}
