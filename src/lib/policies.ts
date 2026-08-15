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
