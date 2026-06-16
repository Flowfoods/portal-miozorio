/**
 * Política de segurança do painel /admin (M13).
 * Constantes puras — compartilhadas entre server actions, NextAuth e UI.
 */

/** Tamanho mínimo de senha do painel (M13: senha forte). */
export const MIN_SENHA = 12;

/** Mensagem padrão para senha curta (UI e server actions falam a mesma língua). */
export const SENHA_CURTA = `A senha precisa de pelo menos ${MIN_SENHA} caracteres.`;

// ── M13.2 — bloqueio progressivo de login ────────────────────────────────────

/** Tentativas falhas toleradas antes da primeira trava. */
export const LOCK_THRESHOLD = 5;
/** Duração da primeira trava (1 min); dobra a cada falha seguinte. */
export const LOCK_BASE_MS = 60_000;
/** Teto da trava (30 min) — não punir demais um esquecimento real. */
export const LOCK_MAX_MS = 30 * 60_000;

/**
 * Função pura. Dado o total ACUMULADO de tentativas falhas (já incrementado),
 * devolve por quantos ms travar a conta a partir de agora — ou 0 se ainda não
 * trava. Backoff exponencial: 5ª falha → 1 min, 6ª → 2 min, ... teto 30 min.
 */
export function lockoutMs(failedAttempts: number): number {
  if (failedAttempts < LOCK_THRESHOLD) return 0;
  const over = failedAttempts - LOCK_THRESHOLD; // 0 na primeira trava
  return Math.min(LOCK_BASE_MS * 2 ** over, LOCK_MAX_MS);
}
