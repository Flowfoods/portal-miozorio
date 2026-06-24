/**
 * Política de segurança do painel /admin (M13).
 * Constantes puras — compartilhadas entre server actions, NextAuth e UI.
 */

import { createHash, randomBytes, timingSafeEqual } from "crypto";

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

// ── M13.4 — token de redefinição de senha ────────────────────────────────────

/** Validade do link de redefinição (1 hora). */
export const RESET_TTL_MS = 60 * 60 * 1000;

/** Token cru, alta entropia (32 bytes), vai só no e-mail — nunca ao banco. */
export function generateResetToken(): string {
  return randomBytes(32).toString("base64url");
}

/** Hash determinístico do token (o que fica no banco). SHA-256 basta: o token
 *  já é aleatório de 256 bits, não é senha — não precisa de salt/bcrypt. */
export function hashResetToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

// ── Cron interno (lembretes, RFV...) ─────────────────────────────────────────

/**
 * Autoriza uma chamada de cron pelo header `Authorization: Bearer $CRON_SECRET`.
 * Comparação em tempo constante; fail-closed (sem a env → false). Usado pelos
 * endpoints /api/cron/* disparados pelo Dokploy Schedules.
 */
export function cronAuthorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = req.headers.get("authorization") ?? "";
  const m = header.match(/^Bearer\s+(.+)$/);
  if (!m) return false;
  const provided = Buffer.from(m[1]!);
  const expected = Buffer.from(secret);
  if (provided.length !== expected.length) return false;
  return timingSafeEqual(provided, expected);
}
