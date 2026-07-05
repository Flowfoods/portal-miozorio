-- Auth F2.2 — recuperação de senha da cliente por código (WhatsApp).
-- Guarda só o SHA-256 do código de 6 dígitos; expira em 10min; máx. 3 tentativas;
-- uso único; last_sent_at controla o cooldown de reenvio (60s). Sem FK forte.
CREATE TABLE "club_password_resets" (
  "id"           UUID NOT NULL DEFAULT gen_random_uuid(),
  "customer_id"  UUID NOT NULL,
  "code_hash"    TEXT NOT NULL,
  "expires_at"   TIMESTAMPTZ NOT NULL,
  "attempts"     INTEGER NOT NULL DEFAULT 0,
  "used_at"      TIMESTAMPTZ,
  "last_sent_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "created_at"   TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "club_password_resets_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "club_password_resets_customer_id_idx" ON "club_password_resets" ("customer_id");
