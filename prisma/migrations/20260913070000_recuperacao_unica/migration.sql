-- B2 — modelo ÚNICO de recuperação de senha (cliente e painel na mesma tabela).
-- O código vai para o WhatsApp da Milene, que repassa à pessoa no número
-- cadastrado. Aditiva (R11): `club_password_resets` continua existindo até os
-- códigos em voo expirarem; nada é apagado por esta migration.
CREATE TABLE IF NOT EXISTS "password_recoveries" (
  "id"                  UUID NOT NULL DEFAULT gen_random_uuid(),
  "perfil"              TEXT NOT NULL,
  "subject_id"          UUID NOT NULL,
  "identificador"       TEXT NOT NULL,
  "code_hash"           TEXT NOT NULL,
  "expires_at"          TIMESTAMPTZ NOT NULL,
  "attempts"            INTEGER NOT NULL DEFAULT 0,
  "used_at"             TIMESTAMPTZ,
  "last_sent_at"        TIMESTAMPTZ NOT NULL DEFAULT now(),
  "notified_at"         TIMESTAMPTZ,
  "notify_error"        TEXT,
  "exchange_hash"       TEXT,
  "exchange_expires_at" TIMESTAMPTZ,
  "origem"              TEXT NOT NULL DEFAULT 'publico',
  "ip_hash"             TEXT,
  "user_agent"          TEXT,
  "created_at"          TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "password_recoveries_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "password_recoveries_perfil_subject_id_idx"
  ON "password_recoveries" ("perfil", "subject_id");
CREATE INDEX IF NOT EXISTS "password_recoveries_created_at_idx"
  ON "password_recoveries" ("created_at");
