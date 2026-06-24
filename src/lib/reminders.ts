import { prisma } from "./prisma";
import { getSiteContent, aplicarTemplate } from "./content";
import { sendEvolutionText, evolutionConfigured } from "./notify";

/**
 * Lembretes automáticos por TEMPO (rodam 1×/dia pelo cron do portal —
 * /api/cron/lembretes, disparado pelo Dokploy Schedules). Substituem o antigo
 * workflow de cron do n8n (que ficou inacessível — container sem URL conhecida).
 *
 * 5 fluxos, todos consultando o banco e enviando pela Evolution dedicada da Mi:
 *   lembrete_24h          agendamento confirmado para amanhã (véspera)
 *   aniversario           membro do clube faz aniversário hoje
 *   aniversario_cliente   1º atendimento concluído faz 1 ano hoje
 *   pos_atendimento       atendimento concluído ontem (D+1)
 *   reconexao             membro do clube sem atendimento há > 12 meses
 *
 * Garantias:
 *  - Idempotente (R10): só envia o que ainda não está em notification_log; grava
 *    o dedup_key após enviar. Rodar 2× no mesmo dia não reenvia.
 *  - Texto vem do CMS (getSiteContent, chaves "msg.<kind>") — fonte única,
 *    editável pela Mi no /admin. Sem cópia de copy no SQL.
 *  - Best-effort por item: a falha de um envio não derruba o lote.
 *  - Env-gated: sem Evolution configurada → no-op.
 *  - Horário em UTC no banco, datas calculadas em America/Sao_Paulo (R4/R16).
 */

export interface DueReminder {
  telefone: string;
  nome: string;
  kind: string;
  dedup_key: string;
  servico: string | null;
  inicio: Date | null;
}

export interface ReminderSummary {
  enviados: number;
  falhas: number;
  porTipo: Record<string, number>;
  skipped?: string;
}

/**
 * SQL dos "devidos hoje" — 5 ramos num UNION ALL, excluindo o que já foi enviado
 * (LEFT JOIN notification_log). NÃO traz texto: a mensagem é montada no app a
 * partir do CMS. Sem parâmetros (só literais + now()), seguro p/ $queryRawUnsafe.
 */
const DUE_SQL = `
WITH devidos AS (
  -- Aniversário (membro do clube faz aniversário hoje)
  SELECT c.phone_e164 AS telefone, c.name AS nome, 'aniversario' AS kind,
         'aniversario:' || c.id || ':' || EXTRACT(YEAR FROM now())::text AS dedup_key,
         NULL::text AS servico, NULL::timestamptz AS inicio
  FROM customers c
  WHERE c.club_joined_at IS NOT NULL AND c.birth_date IS NOT NULL
    AND EXTRACT(MONTH FROM c.birth_date) = EXTRACT(MONTH FROM now())
    AND EXTRACT(DAY   FROM c.birth_date) = EXTRACT(DAY   FROM now())

  UNION ALL
  -- +1 ano de cliente (1º atendimento concluído faz 1 ano hoje)
  SELECT c.phone_e164, c.name, 'aniversario_cliente',
         'aniversario_cliente:' || c.id || ':' || EXTRACT(YEAR FROM now())::text,
         NULL, NULL
  FROM customers c
  JOIN (SELECT customer_id, MIN(starts_at) AS primeiro
          FROM bookings WHERE status = 'completed' GROUP BY customer_id) b
    ON b.customer_id = c.id
  WHERE (b.primeiro AT TIME ZONE 'America/Sao_Paulo')::date
      = (now() AT TIME ZONE 'America/Sao_Paulo')::date - INTERVAL '1 year'

  UNION ALL
  -- Pós-atendimento D+1 (atendimento concluído ontem)
  SELECT c.phone_e164, c.name, 'pos_atendimento',
         'pos_atendimento:' || bk.id,
         s.name, bk.starts_at
  FROM bookings bk
  JOIN customers c ON c.id = bk.customer_id
  JOIN services  s ON s.id = bk.service_id
  WHERE bk.status = 'completed'
    AND (bk.starts_at AT TIME ZONE 'America/Sao_Paulo')::date
      = (now() AT TIME ZONE 'America/Sao_Paulo')::date - INTERVAL '1 day'

  UNION ALL
  -- Reconexão (membro do clube sem atendimento há mais de 12 meses)
  SELECT c.phone_e164, c.name, 'reconexao',
         'reconexao:' || c.id || ':' || to_char(now(), 'YYYY-MM'),
         NULL, NULL
  FROM customers c
  JOIN (SELECT customer_id, MAX(starts_at) AS ultimo
          FROM bookings WHERE status = 'completed' GROUP BY customer_id) b
    ON b.customer_id = c.id
  WHERE c.club_joined_at IS NOT NULL AND b.ultimo < now() - INTERVAL '12 months'

  UNION ALL
  -- Lembrete da véspera (agendamento CONFIRMADO para amanhã)
  SELECT c.phone_e164, c.name, 'lembrete_24h',
         'lembrete_24h:' || bk.id,
         s.name, bk.starts_at
  FROM bookings bk
  JOIN customers c ON c.id = bk.customer_id
  JOIN services  s ON s.id = bk.service_id
  WHERE bk.status = 'confirmed'
    AND (bk.starts_at AT TIME ZONE 'America/Sao_Paulo')::date
      = (now() AT TIME ZONE 'America/Sao_Paulo')::date + INTERVAL '1 day'
)
SELECT d.telefone, d.nome, d.kind, d.dedup_key, d.servico, d.inicio
FROM devidos d
LEFT JOIN notification_log n ON n.dedup_key = d.dedup_key
WHERE n.dedup_key IS NULL
`;

/** Busca no banco os lembretes devidos hoje ainda não enviados. */
export function fetchDueReminders(): Promise<DueReminder[]> {
  return prisma.$queryRawUnsafe<DueReminder[]>(DUE_SQL);
}

/** Data/hora no formato curto pt-BR, fuso da Mi. "" quando não há `inicio`. */
function fmtData(inicio: Date | null): string {
  return inicio
    ? new Date(inicio).toLocaleString("pt-BR", {
        timeZone: "America/Sao_Paulo",
        dateStyle: "short",
        timeStyle: "short",
      })
    : "";
}

/**
 * Monta o texto de um lembrete a partir do template do CMS (msg.<kind>) +
 * placeholders {nome}/{servico}/{data}. Null se não houver template p/ o kind.
 */
export function buildReminderText(
  content: Record<string, string>,
  r: DueReminder,
): string | null {
  const tpl = content[`msg.${r.kind}`];
  if (!tpl) return null;
  return aplicarTemplate(tpl, {
    nome: r.nome ?? "",
    servico: r.servico ?? "",
    data: fmtData(r.inicio),
  });
}

/**
 * Processa os devidos: monta texto (CMS), envia (sender) e registra (logger)
 * cada item, best-effort. `sender` e `logger` são injetados — núcleo testável
 * sem banco nem rede.
 */
export async function processReminders(
  rows: DueReminder[],
  content: Record<string, string>,
  sender: (number: string, text: string) => Promise<void>,
  logger: (kind: string, dedupKey: string) => Promise<void>,
): Promise<ReminderSummary> {
  const summary: ReminderSummary = { enviados: 0, falhas: 0, porTipo: {} };
  for (const r of rows) {
    const number = String(r.telefone ?? "").replace(/\D/g, "");
    const text = buildReminderText(content, r);
    if (!number || !text) {
      summary.falhas++;
      continue;
    }
    try {
      await sender(number, text);
      await logger(r.kind, r.dedup_key);
      summary.enviados++;
      summary.porTipo[r.kind] = (summary.porTipo[r.kind] ?? 0) + 1;
    } catch (e) {
      summary.falhas++;
      console.error("reminders: falha ao enviar", r.kind, r.dedup_key, e);
    }
  }
  return summary;
}

export interface ReminderPreview {
  total: number;
  porTipo: Record<string, number>;
  amostra: { kind: string; telefone: string; texto: string }[];
}

/** Telefone mascarado para o dry-run (só os 4 últimos dígitos). */
function maskPhone(p: string): string {
  const d = String(p ?? "").replace(/\D/g, "");
  return d.length >= 4 ? `***${d.slice(-4)}` : "***";
}

/**
 * Dry-run: mostra o que SERIA enviado hoje (contagem por tipo + amostra com
 * telefone mascarado e o texto final), SEM enviar nem gravar. Para validar o
 * SQL/copy em produção com segurança antes de ligar o agendamento.
 */
export async function previewDueReminders(): Promise<ReminderPreview> {
  const [rows, content] = await Promise.all([
    fetchDueReminders(),
    getSiteContent(),
  ]);
  const porTipo: Record<string, number> = {};
  const amostra: ReminderPreview["amostra"] = [];
  for (const r of rows) {
    porTipo[r.kind] = (porTipo[r.kind] ?? 0) + 1;
    if (amostra.length < 10) {
      amostra.push({
        kind: r.kind,
        telefone: maskPhone(r.telefone),
        texto: buildReminderText(content, r) ?? "(sem template)",
      });
    }
  }
  return { total: rows.length, porTipo, amostra };
}

/** Roda os lembretes do dia (best-effort, idempotente, env-gated). */
export async function runDailyReminders(): Promise<ReminderSummary> {
  if (!evolutionConfigured()) {
    return {
      enviados: 0,
      falhas: 0,
      porTipo: {},
      skipped: "evolution-nao-configurada",
    };
  }
  const [rows, content] = await Promise.all([
    fetchDueReminders(),
    getSiteContent(),
  ]);
  return processReminders(rows, content, sendEvolutionText, (kind, dedupKey) =>
    prisma.notificationLog.create({ data: { kind, dedupKey } }).then(() => {}),
  );
}
