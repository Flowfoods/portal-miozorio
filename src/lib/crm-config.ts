import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";

/**
 * CRM 2.0 F2 — configuração da régua RFV editável pela Mi.
 *
 * Modelo: FAIXAS FIXAS configuráveis (não mais quintis dinâmicos). Cada eixo
 * tem 4 cortes que dividem em 5 notas; os segmentos são REGRAS ordenadas
 * (primeira que casar vence) sobre as notas — nomes livres, regras por
 * mínimo/máximo em cada eixo. Um segmento pode ter várias regras (linhas com o
 * mesmo nome). Se nenhuma regra casar, vale o nome da última (rede de segurança).
 *
 * Zero hardcode (R15): sem linha no banco valem os DEFAULTS abaixo, que
 * reproduzem a segmentação anterior (segmentoRFV legada) — deploy não muda
 * comportamento até a Mi salvar.
 */

// ── Tipos + validação ────────────────────────────────────────────────────────

/** 4 cortes crescentes → 5 notas. */
const cortesSchema = z
  .tuple([
    z.number().int().min(0),
    z.number().int().min(0),
    z.number().int().min(0),
    z.number().int().min(0),
  ])
  .refine((c) => c[0] <= c[1] && c[1] <= c[2] && c[2] <= c[3], {
    message: "Os cortes precisam estar em ordem crescente.",
  });

const notaSchema = z.number().int().min(1).max(5);

const regraSegmentoSchema = z.object({
  nome: z.string().trim().min(2).max(30),
  rMin: notaSchema.optional(),
  rMax: notaSchema.optional(),
  fMin: notaSchema.optional(),
  fMax: notaSchema.optional(),
  vMin: notaSchema.optional(),
  vMax: notaSchema.optional(),
});

export const crmConfigSchema = z.object({
  /** Janela de análise de F e V, em meses. */
  janelaMeses: z.number().int().min(1).max(60),
  /** Recência em DIAS desde a última visita (menor = melhor): nota 5 até c1,
   *  nota 4 até c2, nota 3 até c3, nota 2 até c4, nota 1 acima. */
  recenciaDias: cortesSchema,
  /** Frequência (nº de atendimentos na janela): nota sobe ao ATINGIR cada corte. */
  frequencia: cortesSchema,
  /** Valor gasto na janela, em CENTAVOS: nota sobe ao atingir cada corte. */
  valorCents: cortesSchema,
  /** Regras ordenadas (primeira que casa vence). Mín. 1. */
  segmentos: z.array(regraSegmentoSchema).min(1).max(20),
  /** Limiares de alerta (F3/F4 leem daqui). */
  limiares: z.object({
    sumidaDias: z.number().int().min(1).max(3650),
    leadFriaDias: z.number().int().min(1).max(365),
    abandonoTentativas: z.number().int().min(1).max(50),
    /** F5: alerta de lead parada no funil de noiva (dias na mesma etapa). */
    funilParadaDias: z.number().int().min(1).max(365).default(14),
  }),
  /**
   * Réguas de mensagens (F4). REGRA DA CASA: nenhuma mensagem sai sozinha —
   * a régua só SUGERE; a Mi edita/personaliza e envia na fila. Ritmo e
   * quantidade abaixo são dela. `.default()` = retrocompat com configs antigas.
   */
  reguas: z
    .object({
      ativas: z.object({
        sumida: z.boolean(),
        abandono: z.boolean(),
        leadFria: z.boolean(),
      }),
      /** Nunca sugerir p/ quem recebeu mensagem há menos de N dias. */
      intervaloPorClienteDias: z.number().int().min(1).max(365),
      /** Máximo de sugestões novas por dia (não afogar a fila da Mi). */
      maxSugestoesPorDia: z.number().int().min(1).max(100),
      templates: z.object({
        sumida: z.string().trim().min(5).max(600),
        abandono: z.string().trim().min(5).max(600),
        leadFria: z.string().trim().min(5).max(600),
      }),
    })
    .default({
      ativas: { sumida: false, abandono: false, leadFria: false },
      intervaloPorClienteDias: 7,
      maxSugestoesPorDia: 10,
      templates: {
        // <!-- APROVAR COM A MI: copies das réguas -->
        sumida:
          "Oi {nome}! Que saudade de você por aqui 💛 Já faz {dias} dias desde o seu último atendimento — bora marcar um horário pra gente se ver de novo?",
        abandono:
          "Oi {nome}! Vi que você deu uma olhadinha nos horários 💛 Ficou alguma dúvida? Posso te ajudar a escolher o melhor.",
        leadFria:
          "Oi {nome}! Aqui é a Mi 💛 Que alegria ter você por perto — quer conhecer o estúdio ou tirar alguma dúvida?",
      },
    }),
});

export type CrmConfigData = z.infer<typeof crmConfigSchema>;
export type RegraSegmento = z.infer<typeof regraSegmentoSchema>;

// ── Defaults (reproduzem a segmentoRFV legada — ordem importa) ───────────────

export const DEFAULT_CRM_CONFIG: CrmConfigData = {
  janelaMeses: 12,
  recenciaDias: [30, 60, 120, 180],
  frequencia: [1, 2, 3, 5],
  valorCents: [15000, 30000, 60000, 120000], // R$150 / 300 / 600 / 1200
  segmentos: [
    { nome: "Campeãs", rMin: 4, fMin: 4, vMin: 4 },
    { nome: "Em risco", rMax: 2, fMin: 3 },
    { nome: "Em risco", rMax: 2, vMin: 3 },
    { nome: "Hibernando", rMax: 2 },
    { nome: "Fiéis", fMin: 4 },
    { nome: "Promissoras", fMax: 2 },
    { nome: "Fiéis" }, // resto (f = 3, ainda ativa)
  ],
  limiares: {
    sumidaDias: 120,
    leadFriaDias: 14,
    abandonoTentativas: 2,
    funilParadaDias: 14,
  },
  reguas: {
    ativas: { sumida: false, abandono: false, leadFria: false },
    intervaloPorClienteDias: 7,
    maxSugestoesPorDia: 10,
    templates: {
      // <!-- APROVAR COM A MI: copies das réguas -->
      sumida:
        "Oi {nome}! Que saudade de você por aqui 💛 Já faz {dias} dias desde o seu último atendimento — bora marcar um horário pra gente se ver de novo?",
      abandono:
        "Oi {nome}! Vi que você deu uma olhadinha nos horários 💛 Ficou alguma dúvida? Posso te ajudar a escolher o melhor.",
      leadFria:
        "Oi {nome}! Aqui é a Mi 💛 Que alegria ter você por perto — quer conhecer o estúdio ou tirar alguma dúvida?",
    },
  },
};

/** Nomes únicos na ordem de aparição (pro dashboard/filtros/cores). */
export function nomesSegmentos(cfg: CrmConfigData): string[] {
  const out: string[] = [];
  for (const s of cfg.segmentos) if (!out.includes(s.nome)) out.push(s.nome);
  return out;
}

// ── Leitura (cache 60s, padrão settings.ts) e gravação versionada ────────────

const TTL_MS = 60_000;
let cache: { at: number; data: CrmConfigData } | null = null;

export async function getCrmConfig(force = false): Promise<CrmConfigData> {
  if (!force && cache && Date.now() - cache.at < TTL_MS) return cache.data;
  const row = await prisma.crmConfig.findFirst({
    orderBy: { createdAt: "desc" },
  });
  let data = DEFAULT_CRM_CONFIG;
  if (row) {
    const parsed = crmConfigSchema.safeParse(row.config);
    if (parsed.success) data = parsed.data;
    else console.error("crm-config: linha inválida no banco, usando defaults");
  }
  cache = { at: Date.now(), data };
  return data;
}

export function invalidateCrmConfigCache(): void {
  cache = null;
}

/** Salva uma NOVA versão (nunca sobrescreve — histórico é a tabela). */
export async function saveCrmConfig(
  data: CrmConfigData,
  criadoPor: string | null,
): Promise<void> {
  await prisma.crmConfig.create({
    data: { config: data as unknown as Prisma.InputJsonValue, criadoPor },
  });
  invalidateCrmConfigCache();
}

// ── Diff leigo entre versões (histórico "de → para") ────────────────────────

const fmtCortes = (c: [number, number, number, number]) => c.join(" / ");

/** Lista de mudanças em linguagem simples entre duas versões. */
export function diffCrmConfig(
  antes: CrmConfigData,
  depois: CrmConfigData,
): string[] {
  const out: string[] = [];
  if (antes.janelaMeses !== depois.janelaMeses) {
    out.push(`Janela: ${antes.janelaMeses} → ${depois.janelaMeses} meses`);
  }
  if (fmtCortes(antes.recenciaDias) !== fmtCortes(depois.recenciaDias)) {
    out.push(
      `Recência (dias): ${fmtCortes(antes.recenciaDias)} → ${fmtCortes(depois.recenciaDias)}`,
    );
  }
  if (fmtCortes(antes.frequencia) !== fmtCortes(depois.frequencia)) {
    out.push(
      `Frequência: ${fmtCortes(antes.frequencia)} → ${fmtCortes(depois.frequencia)}`,
    );
  }
  if (fmtCortes(antes.valorCents) !== fmtCortes(depois.valorCents)) {
    const emReais = (c: [number, number, number, number]) =>
      c.map((v) => `R$${Math.round(v / 100)}`).join(" / ");
    out.push(`Valor: ${emReais(antes.valorCents)} → ${emReais(depois.valorCents)}`);
  }
  const segA = JSON.stringify(antes.segmentos);
  const segB = JSON.stringify(depois.segmentos);
  if (segA !== segB) {
    out.push(
      `Segmentos: ${nomesSegmentos(antes).join(", ")} → ${nomesSegmentos(depois).join(", ")}`,
    );
  }
  const la = antes.limiares;
  const lb = depois.limiares;
  if (la.sumidaDias !== lb.sumidaDias) {
    out.push(`Cliente sumida após: ${la.sumidaDias} → ${lb.sumidaDias} dias`);
  }
  if (la.leadFriaDias !== lb.leadFriaDias) {
    out.push(`Lead fria após: ${la.leadFriaDias} → ${lb.leadFriaDias} dias`);
  }
  if (la.abandonoTentativas !== lb.abandonoTentativas) {
    out.push(
      `Abandono relevante após: ${la.abandonoTentativas} → ${lb.abandonoTentativas} tentativas`,
    );
  }
  if (la.funilParadaDias !== lb.funilParadaDias) {
    out.push(
      `Noiva parada no funil após: ${la.funilParadaDias} → ${lb.funilParadaDias} dias`,
    );
  }
  const ra = antes.reguas;
  const rb = depois.reguas;
  const onOff = (b: boolean) => (b ? "ligada" : "desligada");
  for (const k of ["sumida", "abandono", "leadFria"] as const) {
    if (ra.ativas[k] !== rb.ativas[k]) {
      out.push(`Régua ${k}: ${onOff(ra.ativas[k])} → ${onOff(rb.ativas[k])}`);
    }
    if (ra.templates[k] !== rb.templates[k]) {
      out.push(`Mensagem da régua ${k} editada`);
    }
  }
  if (ra.intervaloPorClienteDias !== rb.intervaloPorClienteDias) {
    out.push(
      `Intervalo por cliente: ${ra.intervaloPorClienteDias} → ${rb.intervaloPorClienteDias} dias`,
    );
  }
  if (ra.maxSugestoesPorDia !== rb.maxSugestoesPorDia) {
    out.push(
      `Sugestões por dia: ${ra.maxSugestoesPorDia} → ${rb.maxSugestoesPorDia}`,
    );
  }
  return out;
}
