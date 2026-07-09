import { getSiteContent, aplicarTemplate } from "./content";
import { sendTransactional } from "./whatsapp/service";

/**
 * Envio de WhatsApp do Clube/encaixe (M4) — direto na Evolution dedicada da Mi.
 *
 * O app monta a mensagem (voz da Mi) e chama o sendText da Evolution via fetch
 * com TLS verificado (sem desligar verificação — segurança). Requer um
 * certificado válido no domínio da Evolution.
 *
 * Garantias:
 *  - Env-gated: sem EVOLUTION_API_URL/KEY/INSTANCE → no-op (não simula envio).
 *  - Idempotente (R10): notification_log.dedup_key único impede reenvio.
 *  - Best-effort: nunca lança ao chamador — falha não desfaz o atendimento.
 */

export interface EventInput {
  /** "club_points" | "booking_confirmation". Vira notification_log.kind. */
  kind: string;
  /** Chave única (R10). Ex.: "club_points_referral:<indicadaId>". */
  dedupKey: string;
  /** Dados do evento (telefone E.164, nome, pontos/serviço/inicio...). */
  data: Record<string, unknown>;
}

/**
 * Texto por tipo de evento, a partir dos templates editáveis pela Mi no
 * /admin (CMS, chaves "msg.*"). Placeholders {nome}/{servico}/{data}/{pontos}/
 * {motivo} são interpolados aqui. Default fiel mora no registry (content.ts).
 *
 * EXPORTADO: o preview do agendamento (feature 5) usa exatamente esta função —
 * fonte única, sem cópia divergente do que o Evolution envia de verdade.
 */
export async function buildEventMessage(
  kind: string,
  d: Record<string, unknown>,
): Promise<string | null> {
  const content = await getSiteContent();
  const nome = String(d.nome ?? "");

  if (kind === "club_points") {
    const motivo = d.motivo ? ` (${String(d.motivo)})` : "";
    return aplicarTemplate(content["msg.club_points"] ?? "", {
      nome,
      pontos: String(d.pontos ?? ""),
      motivo,
    });
  }
  if (kind === "booking_confirmation") {
    const data = d.inicio
      ? new Date(String(d.inicio)).toLocaleString("pt-BR", {
          timeZone: "America/Sao_Paulo",
          dateStyle: "short",
          timeStyle: "short",
        })
      : "";
    return aplicarTemplate(content["msg.booking_confirmation"] ?? "", {
      nome,
      servico: String(d.servico ?? ""),
      data,
    });
  }
  // Momentos (F3 — Área da Cliente)
  if (kind === "momento_pendente") {
    return aplicarTemplate(content["msg.momento_pendente"] ?? "", { nome });
  }
  if (kind === "momento_aprovado") {
    const pts = String(d.pontos ?? "");
    return aplicarTemplate(content["msg.momento_aprovado"] ?? "", {
      nome,
      pontos: pts ? `\n\nE você ganhou ${pts} pontos no Clube 🎁` : "",
    });
  }
  if (kind === "momento_nao_publicado") {
    return aplicarTemplate(content["msg.momento_nao_publicado"] ?? "", { nome });
  }
  return null;
}

// Envio de baixo nível vive em ./whatsapp/evolution (evita ciclo com o service).
// Reexportado aqui por retrocompatibilidade dos importadores existentes.
export { evolutionConfigured, sendEvolutionText } from "./whatsapp/evolution";

/**
 * Envia o WhatsApp do evento (best-effort, idempotente, env-gated). Agora passa
 * pelo outbox (WhatsAppService) — dedupeKey garante idempotência e o envio fica
 * rastreável com retry. TRANSACIONAL (não bloqueado por opt-out).
 */
export async function dispatchEvent(input: EventInput): Promise<void> {
  try {
    const number = String(input.data.telefone ?? "").replace(/\D/g, "");
    const text = await buildEventMessage(input.kind, input.data);
    if (!number || !text) return;
    await sendTransactional({
      telefone: number,
      texto: text,
      dedupeKey: input.dedupKey,
      templateKey: input.kind,
      clienteId: (input.data.clienteId as string | undefined) ?? null,
    });
  } catch (e) {
    console.error("notify: falha ao enviar WhatsApp", input.kind, e);
  }
}
