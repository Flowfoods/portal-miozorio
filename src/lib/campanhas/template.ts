import { aplicarTemplate } from "../content";
import type { ClienteSegmento } from "./segmento";

/**
 * Render dos textos de campanha (F2). Variáveis: {nome} {servico_ultimo}
 * {dias_sem_vir} {link_agenda} {pontos_clube}.
 *
 * REGRA INVIOLÁVEL: cliente de funil (noiva/debutante) NUNCA recebe link de
 * booking — {link_agenda} vira o WhatsApp da Mi. Garantido aqui e testado.
 */

export interface RenderOpts {
  siteUrl: string;
  /** Link do WhatsApp da Mi (wa.me/...), p/ noiva/debutante. */
  waMi: string;
  /** Código de serviço p/ deep link (/agendar?servico=code). Opcional. */
  servicoLink?: string | null;
}

function primeiroNome(nome: string): string {
  return (nome ?? "").trim().split(/\s+/)[0] ?? "";
}

/** Destino do {link_agenda}: WhatsApp p/ funil; senão o deep link de agenda. */
export function linkAgenda(cli: Pick<ClienteSegmento, "funil">, o: RenderOpts): string {
  if (cli.funil) return o.waMi; // noiva/debutante: sempre WhatsApp, nunca booking
  const q = o.servicoLink ? `?servico=${o.servicoLink}` : "";
  return `${o.siteUrl.replace(/\/$/, "")}/agendar${q}`;
}

export function renderCampanha(
  corpo: string,
  cli: ClienteSegmento,
  o: RenderOpts,
): string {
  return aplicarTemplate(corpo, {
    nome: primeiroNome(cli.nome),
    servico_ultimo: cli.servicoUltimo ?? "seu atendimento",
    dias_sem_vir: cli.diasSemVir != null ? String(cli.diasSemVir) : "",
    pontos_clube: String(cli.pontosClube ?? 0),
    link_agenda: linkAgenda(cli, o),
  });
}

/** True se o texto contém um link de booking (/agendar) — proibido p/ funil. */
export function temLinkBooking(texto: string): boolean {
  return /\/agendar\b/i.test(texto);
}
