import { prisma } from "./prisma";

/**
 * Emissão de eventos para automação — metade do app do M4 (Clube → WhatsApp).
 *
 * Arquitetura FlowFoods: o app NÃO fala direto com a Evolution API. Ele POSTa
 * um evento no webhook do n8n (N8N_WEBHOOK_URL), e o n8n decide a mensagem e
 * envia via Evolution. Aqui é só o disparo do evento — o workflow n8n + a
 * instância evo-miozorio são infra (a montar na VPS).
 *
 * Garantias:
 *  - Env-gated: sem N8N_WEBHOOK_URL, vira no-op (NÃO simula envio — regra do
 *    projeto: nada de log falso de WhatsApp).
 *  - Idempotente (R10): notification_log.dedup_key único impede reenvio.
 *  - Best-effort: nunca lança para o chamador — falha não desfaz o negócio.
 *
 * Contrato do payload (o workflow n8n consome isto):
 *   { kind, dedupKey, ...dados do evento }
 */

export interface ClubEventInput {
  /** Tipo do evento, ex.: "club_milestone". Vira notification_log.kind. */
  kind: string;
  /** Chave única do evento (R10). Ex.: "club_milestone:<embaixadoraId>:<nivel>". */
  dedupKey: string;
  /** Dados específicos do evento (telefone E.164, nome, benefício...). */
  data: Record<string, unknown>;
}

/** Emite um evento ao n8n (best-effort, idempotente, env-gated). */
export async function dispatchClubEvent(input: ClubEventInput): Promise<void> {
  const url = process.env.N8N_WEBHOOK_URL;
  if (!url) return; // n8n ainda não configurado: não envia nada.

  try {
    // Idempotência (R10): já emitimos este evento? Então não repete.
    const exists = await prisma.notificationLog.findUnique({
      where: { dedupKey: input.dedupKey },
    });
    if (exists) return;

    const token = process.env.N8N_WEBHOOK_TOKEN;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { "x-webhook-token": token } : {}),
      },
      body: JSON.stringify({ kind: input.kind, ...input.data }),
    });
    if (!res.ok) throw new Error(`n8n respondeu ${res.status}`);

    await prisma.notificationLog.create({
      data: { kind: input.kind, dedupKey: input.dedupKey },
    });
  } catch (e) {
    // Best-effort: registra e segue — o atendimento/indicação não pode falhar
    // por causa de uma notificação.
    console.error("notify: falha ao emitir evento", input.kind, e);
  }
}
