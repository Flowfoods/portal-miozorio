import { prisma } from "./prisma";
import { getSiteContent, aplicarTemplate } from "./content";

/**
 * Motor de Jornadas (CRM — Pilar 3): fluxos de relacionamento por comportamento.
 * v1 cobre os fluxos NOVOS — boas_vindas, manutencao, reativacao. (Pós-atendimento,
 * aniversário e reconexão seguem no cron de lembretes; não duplicar.)
 *
 * Seguranças:
 *  - Só processa jornadas ATIVAS (nascem desativadas — revisão da Mi).
 *  - Só envia a quem deu opt-in de WhatsApp (R3/LGPD).
 *  - Idempotente: cria EnvioMensagem com dedup_key único ANTES de enviar (R10).
 *  - Best-effort, env-gated (Evolution direto, sem n8n).
 */

export type Gatilho = "boas_vindas" | "manutencao" | "reativacao";
export const GATILHOS: Gatilho[] = ["boas_vindas", "manutencao", "reativacao"];

/** Cadência padrão de manutenção (dias) — configurável em business_settings. */
export const MANUTENCAO_DIAS_DEFAULT = 60;

export interface Elegivel {
  customerId: string;
  telefone: string;
  nome: string;
  servico: string | null;
  dedupKey: string;
}

export interface EtapaMsg {
  templateKey: string | null;
  template: string | null;
}

/** Monta o texto da etapa: template do CMS (templateKey) ou inline; interpola. */
export function buildJornadaText(
  content: Record<string, string>,
  etapa: EtapaMsg,
  e: Pick<Elegivel, "nome" | "servico">,
): string | null {
  const doCms = etapa.templateKey ? content[etapa.templateKey] : undefined;
  const tpl = doCms ?? etapa.template;
  if (!tpl) return null;
  return aplicarTemplate(tpl, { nome: e.nome ?? "", servico: e.servico ?? "" });
}

/** Cadência de manutenção (dias) lida de business_settings, com fallback. */
async function manutencaoDias(): Promise<number> {
  const row = await prisma.businessSetting.findUnique({
    where: { key: "jornada_manutencao_dias" },
  });
  const n = row ? Number(row.value as unknown) : NaN;
  return Number.isFinite(n) && n > 0 ? n : MANUTENCAO_DIAS_DEFAULT;
}

/**
 * Clientes elegíveis para um gatilho — sempre com opt-in e excluindo quem já
 * recebeu (NOT EXISTS em envios_mensagem). Janelas calculadas no SQL.
 */
async function elegiveis(gatilho: string): Promise<Elegivel[]> {
  if (gatilho === "boas_vindas") {
    // 1º atendimento concluído nos últimos 7 dias (sem blast histórico). 1×/cliente.
    return prisma.$queryRawUnsafe<Elegivel[]>(`
      SELECT c.id AS "customerId", c.phone_e164 AS telefone, c.name AS nome,
             NULL::text AS servico, 'boas_vindas:' || c.id AS "dedupKey"
      FROM customers c
      JOIN (SELECT customer_id, MIN(starts_at) AS primeiro
              FROM bookings WHERE status = 'completed' GROUP BY customer_id) b
        ON b.customer_id = c.id
      WHERE c.whatsapp_opt_in = true
        AND b.primeiro >= now() - INTERVAL '7 days'
        AND NOT EXISTS (SELECT 1 FROM envios_mensagem e WHERE e.dedup_key = 'boas_vindas:' || c.id)
    `);
  }
  if (gatilho === "manutencao") {
    const dias = await manutencaoDias();
    // Último atendimento há ≥ X dias, sem agendamento futuro. No máx. 1×/mês.
    return prisma.$queryRawUnsafe<Elegivel[]>(`
      SELECT c.id AS "customerId", c.phone_e164 AS telefone, c.name AS nome,
             s.name AS servico,
             'manutencao:' || c.id || ':' || to_char(now(), 'YYYY-MM') AS "dedupKey"
      FROM customers c
      JOIN LATERAL (
        SELECT b.service_id, b.starts_at FROM bookings b
        WHERE b.customer_id = c.id AND b.status = 'completed'
        ORDER BY b.starts_at DESC LIMIT 1
      ) ult ON true
      JOIN services s ON s.id = ult.service_id
      WHERE c.whatsapp_opt_in = true
        AND ult.starts_at <= now() - INTERVAL '${dias} days'
        AND NOT EXISTS (
          SELECT 1 FROM bookings f WHERE f.customer_id = c.id
            AND f.starts_at > now() AND f.status IN ('confirmed', 'pending'))
        AND NOT EXISTS (
          SELECT 1 FROM envios_mensagem e
          WHERE e.dedup_key = 'manutencao:' || c.id || ':' || to_char(now(), 'YYYY-MM'))
    `);
  }
  if (gatilho === "reativacao") {
    // Segmento RFV "Em risco"/"Hibernando". No máx. 1×/mês.
    return prisma.$queryRawUnsafe<Elegivel[]>(`
      SELECT c.id AS "customerId", c.phone_e164 AS telefone, c.name AS nome,
             NULL::text AS servico,
             'reativacao:' || c.id || ':' || to_char(now(), 'YYYY-MM') AS "dedupKey"
      FROM customers c
      WHERE c.whatsapp_opt_in = true
        AND c.rfv_segmento IN ('Em risco', 'Hibernando')
        AND NOT EXISTS (
          SELECT 1 FROM envios_mensagem e
          WHERE e.dedup_key = 'reativacao:' || c.id || ':' || to_char(now(), 'YYYY-MM'))
    `);
  }
  return [];
}

export interface JornadaResumo {
  /** F4: jornadas não enviam mais — SUGEREM na fila de aprovação da Mi. */
  sugeridos: number;
  falhas: number;
  porGatilho: Record<string, number>;
  skipped?: string;
}

/**
 * Processa todas as jornadas ATIVAS: para cada elegível, cria o EnvioMensagem
 * já com o texto pronto em status `aguardando` — a FILA (/admin/crm/mensagens)
 * é quem envia, depois que a Mi editar/personalizar (regra da casa, F4).
 */
export async function processarJornadas(): Promise<JornadaResumo> {
  const [jornadas, content] = await Promise.all([
    prisma.jornada.findMany({
      where: { ativo: true },
      include: { etapas: { orderBy: { ordem: "asc" }, take: 1 } },
    }),
    getSiteContent(),
  ]);

  const resumo: JornadaResumo = { sugeridos: 0, falhas: 0, porGatilho: {} };
  for (const j of jornadas) {
    const etapa = j.etapas[0];
    if (!etapa) continue;
    const lista = await elegiveis(j.gatilho);
    for (const e of lista) {
      const number = String(e.telefone ?? "").replace(/\D/g, "");
      const text = buildJornadaText(content, etapa, e);
      if (!number || !text) {
        resumo.falhas++;
        continue;
      }
      // Cria a SUGESTÃO (dedup_key único — corrida/duplicado pula, R10).
      // Envio real só na fila, com o texto que a Mi aprovar.
      try {
        await prisma.envioMensagem.create({
          data: {
            customerId: e.customerId,
            jornadaId: j.id,
            kind: j.gatilho,
            dedupKey: e.dedupKey,
            status: "aguardando",
            texto: text,
          },
        });
        resumo.sugeridos++;
        resumo.porGatilho[j.gatilho] = (resumo.porGatilho[j.gatilho] ?? 0) + 1;
      } catch {
        continue; // já existe (R10)
      }
    }
  }
  return resumo;
}
