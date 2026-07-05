-- Auth F3 — Passkeys (WebAuthn). Adicional à senha (fallback preservado).
CREATE TABLE "passkeys" (
  "id"            UUID NOT NULL DEFAULT gen_random_uuid(),
  "area"          TEXT NOT NULL,
  "subject_id"    UUID NOT NULL,
  "credential_id" TEXT NOT NULL,
  "public_key"    TEXT NOT NULL,
  "counter"       BIGINT NOT NULL DEFAULT 0,
  "transports"    TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "device_name"   TEXT NOT NULL,
  "created_at"    TIMESTAMPTZ NOT NULL DEFAULT now(),
  "last_used_at"  TIMESTAMPTZ,
  CONSTRAINT "passkeys_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "passkeys_credential_id_key" ON "passkeys" ("credential_id");
CREATE INDEX "passkeys_area_subject_id_idx" ON "passkeys" ("area", "subject_id");
