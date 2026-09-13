import { DateTime } from "luxon";

/**
 * Políticas de cancelamento e reincidência — funções PURAS (testáveis isoladas).
 * Parâmetros (prazo, limite de strikes) vêm de business_settings (R3), nunca
 * hardcode. Ref.: booking-engine SKILL §5.
 */

// ── Sinal (A7) ───────────────────────────────────────────────────────────────

export interface SinalInput {
  /** Reincidência (customers.requires_deposit, escrito pelas regras abaixo). */
  clienteExigeSinal: boolean;
  /** Flag manual do catálogo, que a Mi liga onde quiser. */
  servicoExigeSinal: boolean;
  /** Valor do atendimento em centavos (já resolvido estúdio × domicílio). */
  priceCents: number;
  depositPercent: number;
  now: DateTime;
  startsAt: DateTime;
  /** Hold curto normal (só para a cliente terminar o formulário). */
  holdMinutes: number;
  depositHoldHours: number;
  depositCutoffHours: number;
}

export interface SinalResult {
  precisaSinal: boolean;
  /** Centavos do sinal, ou null quando não há sinal. */
  depositCents: number | null;
  /** Até quando o horário fica guardado. */
  holdExpiresAt: DateTime;
}

/**
 * Decide se a reserva nasce esperando sinal, quanto é e por quanto tempo o
 * horário fica guardado.
 *
 * O portal NÃO cobra: não existe gateway, e o PIX do sinal vai direto para a
 * Mi. Por isso o sinal aqui não é uma trava de pagamento — é só um prazo de
 * combinação mais generoso que o hold de minutos, que existia apenas para a
 * cliente terminar o formulário. Antes disto uma reserva com sinal morria em 8
 * minutos sem que ninguém pudesse fazer nada a respeito.
 */
export function avaliarSinal(input: SinalInput): SinalResult {
  const precisaSinal = input.clienteExigeSinal || input.servicoExigeSinal;
  const holdPadrao = input.now.plus({ minutes: input.holdMinutes });
  if (!precisaSinal) {
    return { precisaSinal: false, depositCents: null, holdExpiresAt: holdPadrao };
  }
  // Teto de horas, mas nunca depois do corte antes do atendimento — não adianta
  // o sinal vencer com a Mi já a caminho. O piso do hold padrão protege contra
  // prazo no passado se um dia o lead time ficar menor que o corte.
  const holdExpiresAt = DateTime.max(
    holdPadrao,
    DateTime.min(
      input.now.plus({ hours: input.depositHoldHours }),
      input.startsAt.minus({ hours: input.depositCutoffHours }),
    ),
  );
  return {
    precisaSinal: true,
    depositCents: Math.round((input.priceCents * input.depositPercent) / 100),
    holdExpiresAt,
  };
}

export interface CancelPolicyInput {
  startsAt: DateTime;
  now: DateTime;
  /** Cancelar com até N dias de antecedência não penaliza. */
  cancelWindowDays: number;
  currentStrikes: number;
  strikeLimit: number;
  /** Havia sinal pago neste booking? */
  hasDeposit: boolean;
  actor: "client" | "business";
}

export interface CancelPolicyResult {
  /** Cancelou dentro do prazo (com antecedência suficiente). */
  withinWindow: boolean;
  /** Sinal retido (fora do prazo, com sinal). */
  depositRetained: boolean;
  newStrikes: number;
  requiresDeposit: boolean;
  finalStatus: "cancelled_by_client" | "cancelled_by_business";
}

export function evaluateCancellation(
  input: CancelPolicyInput,
): CancelPolicyResult {
  const deadline = input.startsAt.minus({ days: input.cancelWindowDays });
  const withinWindow = input.now <= deadline;

  // Cancelamento pelo negócio nunca penaliza a cliente nem retém sinal.
  if (input.actor === "business") {
    return {
      withinWindow,
      depositRetained: false,
      newStrikes: input.currentStrikes,
      requiresDeposit: input.currentStrikes >= input.strikeLimit,
      finalStatus: "cancelled_by_business",
    };
  }

  // Cliente fora do prazo: retém sinal (se houver) + 1 strike.
  const outOfWindow = !withinWindow;
  const newStrikes = input.currentStrikes + (outOfWindow ? 1 : 0);
  return {
    withinWindow,
    depositRetained: outOfWindow && input.hasDeposit,
    newStrikes,
    requiresDeposit: newStrikes >= input.strikeLimit,
    finalStatus: "cancelled_by_client",
  };
}

export interface NoShowInput {
  currentStrikes: number;
  strikeLimit: number;
  hasDeposit: boolean;
}

export interface NoShowResult {
  depositRetained: boolean;
  newStrikes: number;
  requiresDeposit: boolean;
}

/** No-show sempre: +1 strike e retém o sinal (se houver). */
export function evaluateNoShow(input: NoShowInput): NoShowResult {
  const newStrikes = input.currentStrikes + 1;
  return {
    depositRetained: input.hasDeposit,
    newStrikes,
    requiresDeposit: newStrikes >= input.strikeLimit,
  };
}

export interface DuracaoItem {
  durationMin: number;
  service: { bufferMin: number };
}

/**
 * Minutos que um atendimento ocupa na agenda: soma das durações dos itens +
 * UM buffer (o maior entre eles). Sem itens, cai no serviço primário.
 *
 * Fonte única para criação e remarcação: quando a remarcação tinha conta
 * própria — só o serviço primário — "Maquiagem + Penteado" encolhia de 135
 * para 75 minutos, e os 60 que sumiam voltavam a ser vendidos no site.
 */
export function duracaoOcupadaMin(
  itens: DuracaoItem[],
  servico: { durationMin: number; bufferMin: number },
): number {
  if (itens.length === 0) return servico.durationMin + servico.bufferMin;
  const duracao = itens.reduce((sum, it) => sum + it.durationMin, 0);
  const buffer = Math.max(...itens.map((it) => it.service.bufferMin));
  return duracao + buffer;
}
