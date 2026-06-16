-- M13.4 — Tokens de redefinição de senha por e-mail (Resend).
-- Aditiva (R11): só CREATE TABLE. Guarda apenas o SHA-256 do token (R21:
-- dado sensível nunca em claro); expira e é de uso único.

CREATE TABLE "password_reset_tokens" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "admin_user_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "used_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "password_reset_tokens_token_hash_key" ON "password_reset_tokens"("token_hash");
CREATE INDEX "password_reset_tokens_admin_user_id_idx" ON "password_reset_tokens"("admin_user_id");
