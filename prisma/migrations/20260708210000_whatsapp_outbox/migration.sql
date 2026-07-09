-- Campanhas F1 — outbox de WhatsApp + opt-out de marketing. Aditiva.

-- Opt-out de marketing na cliente. Default true faz a base ATUAL toda receber
-- (backfill implícito do ADD COLUMN); "SAIR"/"PARAR" seta false depois.
ALTER TABLE "customers" ADD COLUMN "aceita_marketing" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "customers" ADD COLUMN "aceita_marketing_em" TIMESTAMPTZ;

-- Outbox: porta única de saída, idempotente (dedupe_key) e com retry.
CREATE TABLE "whatsapp_message" (
  "id"                UUID NOT NULL DEFAULT gen_random_uuid(),
  "cliente_id"        UUID,
  "telefone"          TEXT NOT NULL,
  "tipo"              TEXT NOT NULL,
  "template_key"      TEXT,
  "texto"             TEXT NOT NULL,
  "payload"           JSONB,
  "status"            TEXT NOT NULL DEFAULT 'QUEUED',
  "tentativas"        INTEGER NOT NULL DEFAULT 0,
  "proxima_tentativa" TIMESTAMPTZ,
  "erro"              TEXT,
  "campanha_id"       UUID,
  "dedupe_key"        TEXT NOT NULL,
  "criado_em"         TIMESTAMPTZ NOT NULL DEFAULT now(),
  "enviado_em"        TIMESTAMPTZ,
  CONSTRAINT "whatsapp_message_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "whatsapp_message_dedupe_key_key" ON "whatsapp_message" ("dedupe_key");
CREATE INDEX "whatsapp_message_status_proxima_idx" ON "whatsapp_message" ("status", "proxima_tentativa");
CREATE INDEX "whatsapp_message_tipo_status_criado_idx" ON "whatsapp_message" ("tipo", "status", "criado_em");
CREATE INDEX "whatsapp_message_cliente_idx" ON "whatsapp_message" ("cliente_id");
