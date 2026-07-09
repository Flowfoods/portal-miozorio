import { prisma } from "../prisma";

/**
 * Motor de segmentos das Campanhas (F2). LÊ o CRM/RFV/bookings/clube existentes —
 * não duplica lógica. Filtros combinam com AND. O WHERE é montado por uma função
 * PURA e VALIDADA (nada de valor cru no SQL): dias/pontos viram inteiros, códigos
 * de serviço passam por regex, segmentos RFV têm aspas escapadas.
 */

export interface SegmentoConfig {
  /** Sem agendamento concluído nos últimos N dias (inatividade). */
  inatividadeDias?: number;
  /** Já fez algum destes serviços (código). */
  fezServico?: string[];
  /** Nunca fez nenhum destes (cross-sell). */
  naoFezServico?: string[];
  /** Segmentos RFV (nomes da régua): Campeãs, Em risco, Hibernando… */
  rfvSegmentos?: string[];
  /** Aniversariantes do mês/da semana. */
  aniversario?: "mes" | "semana";
  /** Saldo de pontos do Clube ≥ N. */
  clubePontosMin?: number;
  /** Leads de noiva/debutante (funil). CTA sempre WhatsApp, nunca booking. */
  funilLeads?: boolean;
  /** Respeitar opt-out de marketing (default true). */
  apenasOptIn?: boolean;
}

const intOf = (v: unknown): number | null => {
  const n = Math.trunc(Number(v));
  return Number.isFinite(n) && n >= 0 ? n : null;
};
const codigosValidos = (arr: unknown): string[] =>
  Array.isArray(arr)
    ? arr.filter((s): s is string => typeof s === "string" && /^[a-z0-9-]{1,60}$/.test(s))
    : [];
const escSql = (s: string) => s.replace(/'/g, "''");
const listaSql = (arr: string[]) => arr.map((s) => `'${escSql(s)}'`).join(", ");

/**
 * Monta o WHERE (sem a palavra WHERE) para a tabela customers aliased `c`.
 * PURA e testável. Sempre exige telefone. Default: respeita opt-out.
 */
export function buildSegmentoWhere(cfg: SegmentoConfig): string {
  const cond: string[] = ["c.phone_e164 IS NOT NULL"];

  if (cfg.apenasOptIn !== false) cond.push("c.aceita_marketing = true");

  const inat = cfg.inatividadeDias != null ? intOf(cfg.inatividadeDias) : null;
  if (inat != null) {
    cond.push(
      `NOT EXISTS (SELECT 1 FROM bookings b WHERE b.customer_id = c.id
        AND b.status = 'completed' AND b.starts_at >= now() - INTERVAL '${inat} days')`,
    );
  }

  const fez = codigosValidos(cfg.fezServico);
  if (fez.length) {
    cond.push(
      `EXISTS (SELECT 1 FROM bookings b JOIN services s ON s.id = b.service_id
        WHERE b.customer_id = c.id AND b.status = 'completed' AND s.code IN (${listaSql(fez)}))`,
    );
  }
  const naoFez = codigosValidos(cfg.naoFezServico);
  if (naoFez.length) {
    cond.push(
      `NOT EXISTS (SELECT 1 FROM bookings b JOIN services s ON s.id = b.service_id
        WHERE b.customer_id = c.id AND b.status = 'completed' AND s.code IN (${listaSql(naoFez)}))`,
    );
  }

  const rfv = Array.isArray(cfg.rfvSegmentos)
    ? cfg.rfvSegmentos.filter((s): s is string => typeof s === "string" && s.length <= 40)
    : [];
  if (rfv.length) cond.push(`c.rfv_segmento IN (${listaSql(rfv)})`);

  if (cfg.aniversario === "mes") {
    cond.push(
      "c.birth_date IS NOT NULL AND EXTRACT(MONTH FROM c.birth_date) = EXTRACT(MONTH FROM now())",
    );
  } else if (cfg.aniversario === "semana") {
    // Aniversário nos próximos 7 dias (compara dia-do-ano, tolera virada).
    cond.push(
      `c.birth_date IS NOT NULL AND (
        (EXTRACT(DOY FROM c.birth_date)::int - EXTRACT(DOY FROM now())::int + 366) % 366 <= 6)`,
    );
  }

  const pontos = cfg.clubePontosMin != null ? intOf(cfg.clubePontosMin) : null;
  if (pontos != null) {
    cond.push(
      `(SELECT COALESCE(SUM(t.pontos), 0) FROM club_transactions t
        WHERE t.customer_id = c.id) >= ${pontos}`,
    );
  }

  if (cfg.funilLeads) cond.push("c.funil_etapa IS NOT NULL");

  return cond.join("\n  AND ");
}

export interface ClienteSegmento {
  id: string;
  nome: string;
  telefone: string;
  servicoUltimo: string | null;
  diasSemVir: number | null;
  pontosClube: number;
  funil: boolean;
}

/** SELECT completo do segmento (dados p/ variáveis de template). */
function resolveSql(where: string, limit?: number): string {
  return `
    SELECT c.id, c.name AS nome, c.phone_e164 AS telefone,
           ult.servico AS "servicoUltimo",
           ult.dias AS "diasSemVir",
           COALESCE(p.saldo, 0)::int AS "pontosClube",
           (c.funil_etapa IS NOT NULL) AS funil
    FROM customers c
    LEFT JOIN LATERAL (
      SELECT s.name AS servico,
             (EXTRACT(EPOCH FROM (now() - b.starts_at)) / 86400)::int AS dias
      FROM bookings b JOIN services s ON s.id = b.service_id
      WHERE b.customer_id = c.id AND b.status = 'completed'
      ORDER BY b.starts_at DESC LIMIT 1
    ) ult ON true
    LEFT JOIN LATERAL (
      SELECT SUM(t.pontos) AS saldo FROM club_transactions t WHERE t.customer_id = c.id
    ) p ON true
    WHERE ${where}
    ORDER BY c.name
    ${limit ? `LIMIT ${intOf(limit) ?? 5}` : ""}`;
}

export async function contarSegmento(cfg: SegmentoConfig): Promise<number> {
  const where = buildSegmentoWhere(cfg);
  const rows = await prisma.$queryRawUnsafe<{ n: bigint }[]>(
    `SELECT count(*)::bigint AS n FROM customers c WHERE ${where}`,
  );
  return Number(rows[0]?.n ?? 0);
}

export async function amostraSegmento(
  cfg: SegmentoConfig,
  n = 5,
): Promise<{ nome: string; telefone: string }[]> {
  const where = buildSegmentoWhere(cfg);
  return prisma.$queryRawUnsafe(
    `SELECT c.name AS nome, c.phone_e164 AS telefone FROM customers c
     WHERE ${where} ORDER BY c.name LIMIT ${intOf(n) ?? 5}`,
  );
}

export async function resolverSegmento(
  cfg: SegmentoConfig,
): Promise<ClienteSegmento[]> {
  const where = buildSegmentoWhere(cfg);
  return prisma.$queryRawUnsafe<ClienteSegmento[]>(resolveSql(where));
}
