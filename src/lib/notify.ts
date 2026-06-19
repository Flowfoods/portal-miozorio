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
 */
async function montarTexto(
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
  return null;
}

/** Envia o WhatsApp do evento (best-effort, idempotente, env-gated). */
export async function dispatchEvent(input: EventInput): Promise<void> {
  const base = process.env.EVOLUTION_API_URL;
  const apikey = process.env.EVOLUTION_API_KEY;
  const instance = process.env.EVOLUTION_INSTANCE;
  if (!base || !apikey || !instance) return; // ainda não configurado

  try {
    // Idempotência (R10): já enviamos este evento? Então não repete.
    const exists = await prisma.notificationLog.findUnique({
      where: { dedupKey: input.dedupKey },
    });
    if (exists) return;

    const number = String(input.data.telefone ?? "").replace(/\D/g, "");
    const text = await montarTexto(input.kind, input.data);
    if (!number || !text) return;

    const res = await fetch(
      `${base.replace(/\/$/, "")}/message/sendText/${instance}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey },
        body: JSON.stringify({ number, text }),
      },
    );
    if (!res.ok) throw new Error(`Evolution respondeu ${res.status}`);

    await prisma.notificationLog.create({
      data: { kind: input.kind, dedupKey: input.dedupKey },
    });
  } catch (e) {
    // Best-effort: registra e segue — o atendimento não pode falhar por causa
    // de uma notificação (ex.: cert ainda inválido faz isso falhar aqui).
    console.error("notify: falha ao enviar WhatsApp", input.kind, e);
  }
}
