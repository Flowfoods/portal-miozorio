import { DateTime } from "luxon";

/**
 * Políticas de cancelamento e reincidência — funções PURAS (testáveis isoladas).
 * Parâmetros (prazo, limite de strikes) vêm de business_settings (R3), nunca
 * hardcode. Ref.: booking-engine SKILL §5.
 */

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
