import { randomBytes } from "crypto";
import { DateTime } from "luxon";
import { prisma } from "./prisma";
import {
  getSettings,
  DEFAULT_CLUB_LADDER,
  type ClubLadderStep,
} from "./settings";

/**
 * Clube de Fidelidade & Indicação — motor de indicação + ciclo de vida.
 * O clube NÃO tem tabela de membro própria: estende customers (uma pessoa =
 * um registro); "ocasião" = booking completed. Sem pontos por R$ gasto — o
 * negócio da Mi é alto ticket / baixa frequência: as alavancas são indicação
 * e recência de ocasião.
 */

// ── Segmentação por ocasião (substitui o RFM de barbearia) ──────────────────

export type SegmentoClube =
  | "NOVA"
  | "RECORRENTE"
  | "EMBAIXADORA"
  | "EM_RECONEXAO";

/** Rótulos para UI (R13: zero jargão). */
export const SEGMENTO_LABEL: Record<SegmentoClube, string> = {
  NOVA: "Nova no clube",
  RECORRENTE: "Recorrente",
  EMBAIXADORA: "Embaixadora",
  EM_RECONEXAO: "Em reconexão",
};

export const SEGMENTO_STYLE: Record<SegmentoClube, string> = {
  NOVA: "bg-mi-bege text-mi-marrom-escuro",
  RECORRENTE: "bg-emerald-100 text-emerald-900",
  EMBAIXADORA: "bg-amber-100 text-amber-900",
  EM_RECONEXAO: "bg-red-50 text-red-800",
};

export interface SegmentoInput {
  /** Quantidade de ocasiões realizadas (bookings completed). */
  ocasioes: number;
  /** Data da última ocasião realizada (null = nenhuma ainda). */
  ultimaOcasiao: Date | null;
  /** Indicações que fecharam (indicadas com ≥1 atendimento realizado). */
  indicacoesFechadas: number;
  /** Agora (injetável p/ teste). */
  now?: DateTime;
}

/**
 * Função pura. Precedência (mais acionável primeiro):
 * EM_RECONEXAO (>12 meses sumida — reativar vale mais que rotular VIP)
 * > EMBAIXADORA (≥1 indicação fechada) > RECORRENTE (2+ ocasiões) > NOVA.
 */
export function segmentoDe(input: SegmentoInput): SegmentoClube {
  const now = input.now ?? DateTime.now();
  if (input.ultimaOcasiao) {
    const meses = now.diff(
      DateTime.fromJSDate(input.ultimaOcasiao),
      "months",
    ).months;
    if (meses > 12) return "EM_RECONEXAO";
  }
  if (input.indicacoesFechadas >= 1) return "EMBAIXADORA";
  if (input.ocasioes >= 2) return "RECORRENTE";
  return "NOVA";
}

/** Ocasiões aceitas no formulário de indicação (R13: linguagem da cliente). */
export const OCASIOES_INDICACAO = [
  "Maquiagem para evento",
  "Penteado",
  "Sobrancelha",
  "Curso de automaquiagem",
  "Vou casar (noiva)",
  "Festa de 15 anos (debutante)",
  "Outra ocasião",
] as const;

// ── Código de indicação ──────────────────────────────────────────────────────

// Sem 0/O/1/I/L — o código vai ser ditado por telefone e digitado do celular.
const CODE_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";

/** Gera "mi-x7k2p9q4" (não adivinhável; LGPD: não é dado pessoal). */
export function gerarCodigoIndicacao(): string {
  const bytes = randomBytes(8);
  let s = "";
  for (let i = 0; i < 8; i++) {
    s += CODE_ALPHABET[bytes[i]! % CODE_ALPHABET.length];
  }
  return `mi-${s}`;
}

// ── Operações de clube (banco) ───────────────────────────────────────────────

/**
 * Garante que a cliente é membro: preenche club_joined_at e referral_code
 * (único — em colisão, raríssima, tenta de novo). Idempotente.
 */
export async function ensureClubMember(customerId: string) {
  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
  });
  if (!customer) return null;
  if (customer.clubJoinedAt && customer.referralCode) return customer;

  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      return await prisma.customer.update({
        where: { id: customerId },
        data: {
          clubJoinedAt: customer.clubJoinedAt ?? new Date(),
          referralCode: customer.referralCode ?? gerarCodigoIndicacao(),
        },
      });
    } catch (e) {
      // P2002 = código colidiu com outro membro; sorteia outro.
      if (!String((e as { code?: string })?.code).includes("P2002")) throw e;
    }
  }
  throw new Error("Não consegui gerar um código de indicação único.");
}

/** Indicações fechadas = indicadas distintas com ≥1 atendimento realizado. */
export function contarIndicacoesFechadas(customerId: string): Promise<number> {
  return prisma.customer.count({
    where: {
      referredById: customerId,
      bookings: { some: { status: "completed" } },
    },
  });
}

export interface MarcoNovo {
  nivel: number;
  beneficio: string;
}

/**
 * Gatilho da escada: chamada quando um booking vira `completed`. Se a cliente
 * do booking foi indicada, reavalia a escada de quem a indicou e cria os
 * marcos atingidos. Idempotente via UNIQUE (customer_id, nivel) — rodar duas
 * vezes não duplica (R10). Retorna só os marcos criados AGORA (insumo do M4:
 * mensagem de parabéns via Evolution — ainda não construído, nada é enviado).
 */
export async function avaliarEscadaIndicacao(
  indicadaId: string,
): Promise<{ embaixadoraId: string; novos: MarcoNovo[] } | null> {
  const indicada = await prisma.customer.findUnique({
    where: { id: indicadaId },
    select: { referredById: true },
  });
  if (!indicada?.referredById) return null;

  const embaixadoraId = indicada.referredById;
  const [fechadas, settings] = await Promise.all([
    contarIndicacoesFechadas(embaixadoraId),
    getSettings(),
  ]);

  const novos: MarcoNovo[] = [];
  for (const step of degrausAtingidos(settings.clubLadder, fechadas)) {
    try {
      await prisma.referralMilestone.create({
        data: {
          customerId: embaixadoraId,
          nivel: step.nivel,
          beneficio: step.beneficio,
        },
      });
      novos.push({ nivel: step.nivel, beneficio: step.beneficio });
    } catch (e) {
      // P2002 = marco já existia (criado num completed anterior) — ok.
      if (!String((e as { code?: string })?.code).includes("P2002")) throw e;
    }
  }

  // Embaixadora ganha código próprio automaticamente (já pode compartilhar).
  if (fechadas >= 1) await ensureClubMember(embaixadoraId);

  return { embaixadoraId, novos };
}

/**
 * Escada para páginas com prerender (landing /clube): nunca lança — sem banco
 * (build local) devolve o fallback, mesmo padrão de getPublishedMedia.
 */
export async function getClubLadder(): Promise<ClubLadderStep[]> {
  try {
    return (await getSettings()).clubLadder;
  } catch {
    return DEFAULT_CLUB_LADDER;
  }
}

/** Função pura: degraus da escada cobertos por N indicações fechadas. */
export function degrausAtingidos(
  ladder: ClubLadderStep[],
  fechadas: number,
): ClubLadderStep[] {
  return ladder
    .filter((s) => s.nivel >= 1 && fechadas >= s.nivel)
    .sort((a, b) => a.nivel - b.nivel);
}
