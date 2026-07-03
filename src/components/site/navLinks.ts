/**
 * Fonte ÚNICA dos links de navegação do site — usada pela <nav> do desktop
 * (Header) e pelo drawer mobile (MobileNav), pra nunca dessincronizar.
 *
 * Regra de negócio (miespecialista): /noivas e /debutantes são VITRINE —
 * a conversão é por WhatsApp, nunca pelo fluxo /agendar. Por isso o CTA
 * "Agendar" é tratado à parte, fora desta lista.
 */
export interface NavItem {
  href: string;
  label: string;
}

export const NAV_LINKS: NavItem[] = [
  { href: "/", label: "Início" },
  { href: "/#servicos", label: "Serviços" },
  { href: "/dia-a-dia", label: "Dia a dia" },
  // Curso é serviço agendável: o link já pré-seleciona no wizard (?servico=).
  { href: "/agendar?servico=curso-automaquiagem", label: "Curso" },
  { href: "/galeria", label: "Galeria" },
  { href: "/noivas", label: "Noivas" },
  { href: "/debutantes", label: "Debutantes" },
  { href: "/clube", label: "Clube" },
  { href: "/sobre", label: "Sobre" },
];
