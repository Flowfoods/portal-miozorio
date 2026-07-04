import { prisma } from "./prisma";
import { getSiteContent, aplicarTemplate } from "./content";

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

/** True se as 3 envs da Evolution estão setadas (URL/KEY/INSTANCE). */
export function evolutionConfigured(): boolean {
  return !!(
    process.env.EVOLUTION_API_URL &&
    process.env.EVOLUTION_API_KEY &&
    process.env.EVOLUTION_INSTANCE
  );
}

/**
 * Envia UM texto pela Evolution (sendText). Fonte única do request HTTP —
 * usada pelos eventos do app (dispatchEvent) e pelo cron diário de lembretes
 * (src/lib/reminders.ts). Lança se a Evolution não estiver configurada ou se a
 * API responder erro; quem chama decide o tratamento (best-effort).
 */
export async function sendEvolutionText(
  number: string,
  text: string,
): Promise<void> {
  const base = process.env.EVOLUTION_API_URL;
  const apikey = process.env.EVOLUTION_API_KEY;
  const instance = process.env.EVOLUTION_INSTANCE;
  if (!base || !apikey || !instance) {
    throw new Error("Evolution não configurada");
  }
  const res = await fetch(
    `${base.replace(/\/$/, "")}/message/sendText/${instance}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey },
      body: JSON.stringify({ number, text }),
    },
  );
  if (!res.ok) throw new Error(`Evolution respondeu ${res.status}`);
}

/** Envia o WhatsApp do evento (best-effort, idempotente, env-gated). */
export async function dispatchEvent(input: EventInput): Promise<void> {
  if (!evolutionConfigured()) return; // ainda não configurado

  try {
    // Idempotência (R10): já enviamos este evento? Então não repete.
    const exists = await prisma.notificationLog.findUnique({
      where: { dedupKey: input.dedupKey },
    });
    if (exists) return;

    const number = String(input.data.telefone ?? "").replace(/\D/g, "");
    const text = await buildEventMessage(input.kind, input.data);
    if (!number || !text) return;

    await sendEvolutionText(number, text);

    await prisma.notificationLog.create({
      data: { kind: input.kind, dedupKey: input.dedupKey },
    });
  } catch (e) {
    // Best-effort: registra e segue — o atendimento não pode falhar por causa
    // de uma notificação (ex.: cert ainda inválido faz isso falhar aqui).
    console.error("notify: falha ao enviar WhatsApp", input.kind, e);
  }
}
