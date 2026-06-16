-- M13.2 — Bloqueio progressivo de login no painel (anti brute-force).
-- Aditiva (R11): só ADD COLUMN com default seguro. Contagem por conta;
-- a política de backoff vive em src/lib/security.ts (função pura testável).

ALTER TABLE "admin_users" ADD COLUMN "failed_attempts" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "admin_users" ADD COLUMN "locked_until" TIMESTAMPTZ;
