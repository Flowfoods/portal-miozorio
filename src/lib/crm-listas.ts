import { prisma } from "./prisma";
import { EV } from "./tracking";
import type { CrmConfigData } from "./crm-config";

/**
 * CRM 2.0 F3 — listas ACIONÁVEIS: transformam os números do dashboard em
 * pessoas com botão de ação. Todos os limiares vêm da régua editável (F2);
 * o comportamento vem dos eventos first-party (F1). Base pequena (estúdio
 * individual) → queries diretas, sem materialização (F6 mede e decide).
 *
 * LGPD: nada aqui expõe dado de saúde; listas só em rota autenticada.
 */

const int = (n: number, min: number, max: number) =>
  Math.max(min, Math.min(max, Math.trunc(n)));

/** Rótulos leigos dos eventos (R13) — para a ficha e relatórios. */
export const EVENTO_LABEL: Record<string, string> = {
  [EV.SESSAO_INICIADA]: "Visitou o site",
  [EV.LOGIN_CLUBE]: "Entrou na conta do Clube",
  [EV.VISUALIZOU_AGENDAMENTO]: "Abriu o agendamento",
  [EV.INICIOU_AGENDAMENTO]: "Começou a agendar",
  [EV.ABANDONOU_AGENDAMENTO]: "Saiu sem concluir o agendamento",
  [EV.AGENDAMENTO_CONCLUIDO]: "Agendou um horário",
  [EV.LINK_INDICACAO_COMPARTILHADO]: "Compartilhou o link de indicação",
  [EV.LINK_INDICACAO_ACESSADO]: "Link de indicação foi aberto",
  [EV.VISUALIZOU_RECOMPENSAS]: "Olhou as recompensas do Clube",
  [EV.RESGATE_REALIZADO]: "Resgatou uma recompensa",
};

export interface LinhaSumida {
  id: string;
  name: string;
  phoneE164: string;
  diasSemVir: number;
  totalGastoCents: number;
  rfvSegmento: string | null;
}

/** Clientes sumidas: mais de X dias sem atendimento, mais valiosas primeiro. */
export async function clientesSumidas(
  sumidaDias: number,
): Promise<LinhaSumida[]> {
  const d = int(sumidaDias, 1, 3650);
  return prisma.$queryRawUnsafe<LinhaSumida[]>(`
SELECT c.id, c.name, c.phone_e164 AS "phoneE164",
       EXTRACT(DAY FROM (now() - MAX(b.starts_at)))::int AS "diasSemVir",
       COALESCE(SUM(b.price_cents), 0)::int AS "totalGastoCents",
       c.rfv_segmento AS "rfvSegmento"
FROM customers c
JOIN bookings b ON b.customer_id = c.id AND b.status = 'completed'
WHERE c.funil_etapa IS NULL
GROUP BY c.id
HAVING MAX(b.starts_at) < now() - INTERVAL '${d} days'
ORDER BY COALESCE(SUM(b.price_cents), 0) DESC
LIMIT 300`);
}

export interface LinhaLeadFria {
  id: string;
  name: string;
  phoneE164: string;
  criadaHaDias: number;
  origem: string | null;
  funilEtapa: string | null;
}

/**
 * Leads que nunca entraram: cadastradas (manual/indicação/funil) há mais de
 * Y dias, sem NENHUM acesso (SESSAO_INICIADA/LOGIN_CLUBE) e sem atendimento.
 */
export async function leadsNuncaEntraram(
  leadFriaDias: number,
): Promise<LinhaLeadFria[]> {
  const d = int(leadFriaDias, 1, 3650);
  return prisma.$queryRawUnsafe<LinhaLeadFria[]>(`
SELECT c.id, c.name, c.phone_e164 AS "phoneE164",
       EXTRACT(DAY FROM (now() - c.created_at))::int AS "criadaHaDias",
       c.origem, c.funil_etapa::text AS "funilEtapa"
FROM customers c
WHERE c.created_at < now() - INTERVAL '${d} days'
  AND NOT EXISTS (
    SELECT 1 FROM client_events e
    WHERE e.client_id = c.id
      AND e.tipo IN ('${EV.SESSAO_INICIADA}', '${EV.LOGIN_CLUBE}')
  )
  AND NOT EXISTS (
    SELECT 1 FROM bookings b
    WHERE b.customer_id = c.id AND b.status = 'completed'
  )
ORDER BY c.created_at DESC
LIMIT 300`);
}

export interface LinhaVisitou {
  id: string;
  name: string;
  phoneE164: string;
  tentativas: number;
  ultimaVez: Date;
}

/**
 * Visitou mas não marcou: teve evento do funil de agendamento no período e
 * NENHUM agendamento concluído no mesmo período. tentativas = eventos de
 * iniciar/abandonar (visualizar só conta quando não houve nada além).
 */
export async function visitouNaoMarcou(
  dias: number,
): Promise<LinhaVisitou[]> {
  const d = int(dias, 1, 365);
  return prisma.$queryRawUnsafe<LinhaVisitou[]>(`
SELECT c.id, c.name, c.phone_e164 AS "phoneE164",
       GREATEST(
         COUNT(*) FILTER (WHERE e.tipo IN ('${EV.INICIOU_AGENDAMENTO}', '${EV.ABANDONOU_AGENDAMENTO}')),
         1
       )::int AS "tentativas",
       MAX(e.created_at) AS "ultimaVez"
FROM customers c
JOIN client_events e ON e.client_id = c.id
  AND e.tipo IN ('${EV.VISUALIZOU_AGENDAMENTO}', '${EV.INICIOU_AGENDAMENTO}', '${EV.ABANDONOU_AGENDAMENTO}')
  AND e.created_at >= now() - INTERVAL '${d} days'
WHERE NOT EXISTS (
    SELECT 1 FROM client_events e2
    WHERE e2.client_id = c.id
      AND e2.tipo = '${EV.AGENDAMENTO_CONCLUIDO}'
      AND e2.created_at >= now() - INTERVAL '${d} days'
  )
  AND NOT EXISTS (
    SELECT 1 FROM bookings b
    WHERE b.customer_id = c.id
      AND b.created_at >= now() - INTERVAL '${d} days'
      AND b.status IN ('pending', 'confirmed', 'completed')
  )
GROUP BY c.id
ORDER BY "tentativas" DESC, "ultimaVez" DESC
LIMIT 300`);
}

export interface LinhaEngajada {
  id: string;
  name: string;
  phoneE164: string;
  compartilhamentos: number;
  indicadasAtendidas: number;
}

/** Engajadas na indicação: ranking de compartilhamentos + indicadas atendidas. */
export async function engajadasIndicacao(): Promise<LinhaEngajada[]> {
  return prisma.$queryRawUnsafe<LinhaEngajada[]>(`
SELECT c.id, c.name, c.phone_e164 AS "phoneE164",
       COUNT(e.id)::int AS "compartilhamentos",
       (SELECT COUNT(DISTINCT r.id) FROM customers r
         JOIN bookings rb ON rb.customer_id = r.id AND rb.status = 'completed'
         WHERE r.referred_by_id = c.id)::int AS "indicadasAtendidas"
FROM customers c
JOIN client_events e ON e.client_id = c.id
  AND e.tipo = '${EV.LINK_INDICACAO_COMPARTILHADO}'
GROUP BY c.id
ORDER BY COUNT(e.id) DESC
LIMIT 300`);
}

// ── Explorar clientes (3.2): filtros combináveis ─────────────────────────────

export interface FiltrosExplorar {
  segmento?: string;
  semContatoDias?: number;
  compartilhou?: boolean;
  origem?: string;
}

export interface LinhaExplorar {
  id: string;
  name: string;
  phoneE164: string;
  rfvSegmento: string | null;
  diasSemVir: number | null;
  visitas30d: number;
  tentativas30d: number;
  indicacoes: number;
  totalGastoCents: number;
}

/** Lista combinável (segmento + dias sem contato + compartilhou + origem). */
export async function explorarClientes(
  f: FiltrosExplorar,
): Promise<LinhaExplorar[]> {
  const conds: string[] = ["c.funil_etapa IS NULL"];
  const params: unknown[] = [];
  if (f.segmento) {
    params.push(f.segmento);
    conds.push(`c.rfv_segmento = $${params.length}`);
  }
  if (f.origem) {
    params.push(f.origem);
    conds.push(`c.origem = $${params.length}`);
  }
  if (f.semContatoDias && f.semContatoDias > 0) {
    conds.push(`(SELECT MAX(b.starts_at) FROM bookings b
       WHERE b.customer_id = c.id AND b.status = 'completed')
       < now() - INTERVAL '${int(f.semContatoDias, 1, 3650)} days'`);
  }
  if (f.compartilhou === true) {
    conds.push(`EXISTS (SELECT 1 FROM client_events e WHERE e.client_id = c.id
       AND e.tipo = '${EV.LINK_INDICACAO_COMPARTILHADO}')`);
  } else if (f.compartilhou === false) {
    conds.push(`NOT EXISTS (SELECT 1 FROM client_events e WHERE e.client_id = c.id
       AND e.tipo = '${EV.LINK_INDICACAO_COMPARTILHADO}')`);
  }

  const sql = `
SELECT c.id, c.name, c.phone_e164 AS "phoneE164", c.rfv_segmento AS "rfvSegmento",
       (SELECT EXTRACT(DAY FROM (now() - MAX(b.starts_at)))::int FROM bookings b
         WHERE b.customer_id = c.id AND b.status = 'completed') AS "diasSemVir",
       (SELECT COUNT(*) FROM client_events e WHERE e.client_id = c.id
         AND e.tipo = '${EV.SESSAO_INICIADA}'
         AND e.created_at >= now() - INTERVAL '30 days')::int AS "visitas30d",
       (SELECT COUNT(*) FROM client_events e WHERE e.client_id = c.id
         AND e.tipo IN ('${EV.INICIOU_AGENDAMENTO}', '${EV.ABANDONOU_AGENDAMENTO}')
         AND e.created_at >= now() - INTERVAL '30 days')::int AS "tentativas30d",
       (SELECT COUNT(*) FROM customers r WHERE r.referred_by_id = c.id)::int AS "indicacoes",
       (SELECT COALESCE(SUM(b.price_cents), 0) FROM bookings b
         WHERE b.customer_id = c.id AND b.status = 'completed')::int AS "totalGastoCents"
FROM customers c
WHERE ${conds.join(" AND ")}
ORDER BY "totalGastoCents" DESC
LIMIT 300`;
  return prisma.$queryRawUnsafe<LinhaExplorar[]>(sql, ...params);
}

// ── Contagens para os cards do dashboard ─────────────────────────────────────

export interface ContagensListas {
  sumidas: number;
  leadsFrias: number;
  visitouNaoMarcou: number;
  engajadas: number;
}

export async function contagensListas(
  cfg: CrmConfigData,
): Promise<ContagensListas> {
  const [s, l, v, e] = await Promise.all([
    clientesSumidas(cfg.limiares.sumidaDias),
    leadsNuncaEntraram(cfg.limiares.leadFriaDias),
    visitouNaoMarcou(30),
    engajadasIndicacao(),
  ]);
  return {
    sumidas: s.length,
    leadsFrias: l.length,
    visitouNaoMarcou: v.length,
    engajadas: e.length,
  };
}
