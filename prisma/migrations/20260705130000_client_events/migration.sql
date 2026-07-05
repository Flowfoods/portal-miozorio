-- CRM 2.0 F1 — camada de eventos de comportamento (first-party). Aditiva (R11):
-- só CREATE TABLE + índices + FK em cascata. Não toca dados existentes.
-- metadata em JSONB nunca guarda dado sensível (R18); FK ON DELETE CASCADE
-- garante que apagar a cliente apaga seus eventos (LGPD).

CREATE TABLE "client_events" (
    "id" BIGSERIAL NOT NULL,
    "client_id" UUID,
    "session_id" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "origem" TEXT NOT NULL DEFAULT 'web',
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "client_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "client_events_client_id_tipo_created_at_idx" ON "client_events"("client_id", "tipo", "created_at");
CREATE INDEX "client_events_tipo_created_at_idx" ON "client_events"("tipo", "created_at");
CREATE INDEX "client_events_session_id_idx" ON "client_events"("session_id");

ALTER TABLE "client_events" ADD CONSTRAINT "client_events_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
