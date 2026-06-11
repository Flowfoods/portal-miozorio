import type { Metadata } from "next";
import AgendarWizard from "@/components/agendar/AgendarWizard";

export const metadata: Metadata = {
  title: "Agendar meu horário · Mi Ozorio",
  description:
    "Agende sua maquiagem ou penteado com a Milene Ozorio. Rápido, fácil e no seu tempo.",
};

export default function AgendarPage() {
  return (
    <main className="min-h-screen">
      <AgendarWizard />
    </main>
  );
}
