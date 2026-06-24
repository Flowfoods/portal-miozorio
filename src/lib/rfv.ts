import { prisma } from "./prisma";

/**
 * Matriz RFV (Recência, Frequência, Valor) — motor de segmentação do CRM.
 *
 * Roda 1×/dia (cron /api/cron/rfv) sobre a BASE ATIVA = clientes com ≥1
 * atendimento concluído e SEM etapa de funil (noiva/debutante ficam fora — R2).
 *
 * - R: dias desde o último atendimento (menos dias = melhor).
 * - F: nº de atendimentos concluídos nos últimos 12 meses.
 * - V: total gasto (centavos) nos últimos 12 meses.
 * Cada eixo recebe score 1–5 por QUINTIS sobre a base ativa. Segmento derivado
 * dos três scores. Datas em UTC no banco; janela calculada com INTERVAL no SQL.
 *
 * As funções puras (cortes/score/segmento/LTV) não tocam o banco e são testadas.
 */

/** Agregados por cliente vindos do banco (uma linha por cliente da base ativa). */
export interface RFVRow {
  id: string;
  r_days: number; // dias desde o último atendimento
  f: number; // atendimentos nos últimos 12 meses
  v: number; // gasto (centavos) nos últimos 12 meses
  total: number; // atendimentos no total (all-time)
  v_total: number; // gasto total (centavos), all-time
}

/** Resultado calculado para um cliente, pronto para gravar. */
export interface RFVScore {
  id: string;
  rScore: number;
  fScore: number;
  vScore: number;
  rfvSegmento: string;
  ltvPrevistoCents: number;
}

/**
 * Cortes de quintis (P20/P40/P60/P80) sobre os valores ordenados. 4 cortes
 * dividem em 5 faixas. Base vazia → cortes zerados (todos caem no score 1/5).
 */
export function quintilCuts(valores: number[]): [number, number, number, number] {
  const xs = [...valores].sort((a, b) => a - b);
  if (xs.length === 0) return [0, 0, 0, 0];
  const at = (p: number) => xs[Math.min(xs.length - 1, Math.floor(p * xs.length))]!;
  return [at(0.2), at(0.4), at(0.6), at(0.8)];
}

/**
 * Score 1–5 a partir dos cortes. `invert` para eixos onde MENOR é melhor
 * (recência: poucos dias = score alto).
 */
export function scoreFromCuts(
  value: number,
  cuts: [number, number, number, number],
  invert = false,
): number {
  let s = 1;
  for (const c of cuts) if (value >= c) s++;
  s = Math.min(5, Math.max(1, s));
  return invert ? 6 - s : s;
}

/**
 * Segmento a partir dos scores (tom Mi Ozorio). Ordem de prioridade clara e
 * exaustiva — todo (r,f,v) ∈ 1..5 cai em exatamente um segmento.
 */
export function segmentoRFV(r: number, f: number, v: number): string {
  if (r >= 4 && f >= 4 && v >= 4) return "Campeãs";
  if (r <= 2) return f >= 3 || v >= 3 ? "Em risco" : "Hibernando";
  // r ∈ 3..5 (ainda ativas):
  if (f >= 4) return "Fiéis";
  if (f <= 2) return "Promissoras"; // recente com poucas visitas
  return "Fiéis"; // f == 3 → recorrente
}

/**
 * LTV previsto (simples, sem ML): ticket médio × frequência anual × horizonte.
 * Frequência anual ≈ atendimentos na janela de 12 meses. Horizonte padrão 3 anos.
 * Cliente sem visita na janela (f=0) → LTV 0 (está inativa). Documentado.
 */
export function ltvPrevistoCents(
  ticketMedioCents: number,
  freqAnual: number,
  horizonteAnos = 3,
): number {
  return Math.round(ticketMedioCents * freqAnual * horizonteAnos);
}

/** Converte uma linha agregada em scores/segmento/LTV, dados os cortes da base. */
export function scoreRow(
  row: RFVRow,
  cutsR: [number, number, number, number],
  cutsF: [number, number, number, number],
  cutsV: [number, number, number, number],
): RFVScore {
  const rScore = scoreFromCuts(row.r_days, cutsR, true); // menos dias = melhor
  const fScore = scoreFromCuts(row.f, cutsF);
  const vScore = scoreFromCuts(row.v, cutsV);
  const ticketMedio = row.f > 0 ? Math.round(row.v / row.f) : 0;
  return {
    id: row.id,
    rScore,
    fScore,
    vScore,
    rfvSegmento: segmentoRFV(rScore, fScore, vScore),
    ltvPrevistoCents: ltvPrevistoCents(ticketMedio, row.f),
  };
}

/** Calcula os scores de toda a base (puro): monta cortes e pontua cada linha. */
export function computeRFV(rows: RFVRow[]): RFVScore[] {
  const cutsR = quintilCuts(rows.map((x) => x.r_days));
  const cutsF = quintilCuts(rows.map((x) => x.f));
  const cutsV = quintilCuts(rows.map((x) => x.v));
  return rows.map((row) => scoreRow(row, cutsR, cutsF, cutsV));
}

/** SQL dos agregados da base ativa (≥1 concluído, sem etapa de funil — R2). */
const AGG_SQL = `
SELECT c.id,
       EXTRACT(DAY FROM (now() - MAX(b.starts_at)))::int AS r_days,
       count(*) FILTER (WHERE b.starts_at >= now() - INTERVAL '12 months')::int AS f,
       COALESCE(sum(b.price_cents) FILTER (WHERE b.starts_at >= now() - INTERVAL '12 months'), 0)::int AS v,
       count(*)::int AS total,
       COALESCE(sum(b.price_cents), 0)::int AS v_total
FROM customers c
JOIN bookings b ON b.customer_id = c.id AND b.status = 'completed'
WHERE c.funil_etapa IS NULL
GROUP BY c.id
`;

/** Busca os agregados da base ativa. */
export function fetchRFVRows(): Promise<RFVRow[]> {
  return prisma.$queryRawUnsafe<RFVRow[]>(AGG_SQL);
}

/**
 * Job diário: recalcula RFV de toda a base ativa e grava nos clientes. Best-effort
 * por linha; retorna o resumo. Quem saiu da base ativa não é zerado aqui (mantém
 * o último score; ajuste futuro se preciso).
 */
export async function recalcularRFV(): Promise<{
  base: number;
  atualizados: number;
  porSegmento: Record<string, number>;
}> {
  const rows = await fetchRFVRows();
  const scores = computeRFV(rows);
  const porSegmento: Record<string, number> = {};
  let atualizados = 0;
  const agora = new Date();
  for (const s of scores) {
    try {
      await prisma.customer.update({
        where: { id: s.id },
        data: {
          rScore: s.rScore,
          fScore: s.fScore,
          vScore: s.vScore,
          rfvSegmento: s.rfvSegmento,
          ltvPrevistoCents: s.ltvPrevistoCents,
          rfvCalculadoEm: agora,
        },
      });
      atualizados++;
      porSegmento[s.rfvSegmento] = (porSegmento[s.rfvSegmento] ?? 0) + 1;
    } catch (e) {
      console.error("rfv: falha ao gravar cliente", s.id, e);
    }
  }
  return { base: rows.length, atualizados, porSegmento };
}
