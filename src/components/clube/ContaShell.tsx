import type { ReactNode } from "react";
import Chip from "@/components/ui/Chip";

/**
 * Shell da Área da Cliente (F1): eyebrow + tabs de navegação interna.
 * Renderizado por cada página logada (não é layout — a página de senha
 * forçada fica fora do shell e cada rota mantém seu próprio guard de sessão).
 * Histórico (F2) e Momentos (F3) entram nesta lista quando ficarem prontas.
 */
export type ContaTab = "inicio" | "historico" | "momentos" | "clube" | "perfil";

const TABS: { id: ContaTab; label: string; href: string }[] = [
  { id: "inicio", label: "Início", href: "/clube/conta" },
  { id: "historico", label: "Histórico", href: "/clube/conta/historico" },
  { id: "momentos", label: "Momentos", href: "/clube/conta/momentos" },
  { id: "clube", label: "Clube", href: "/clube/conta/clube" },
  { id: "perfil", label: "Perfil", href: "/clube/conta/perfil" },
];

export default function ContaShell({
  ativo,
  children,
}: {
  ativo: ContaTab;
  children: ReactNode;
}) {
  return (
    <main className="mx-auto max-w-lg px-5 pb-24 pt-10">
      <p className="font-corpo text-xs uppercase tracking-[0.3em] text-mi-marrom">
        Área da Cliente · Mi Ozorio
      </p>
      <nav aria-label="Sua área" className="mi-carrossel -mx-5 mt-4 px-5">
        {TABS.map((tab) => (
          <Chip key={tab.id} href={tab.href} ativo={tab.id === ativo}>
            {tab.label}
          </Chip>
        ))}
      </nav>
      <div className="mt-6">{children}</div>
    </main>
  );
}
