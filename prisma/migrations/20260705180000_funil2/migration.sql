-- CRM 2.0 F5 — funil de noiva 2.0. Aditiva (R11).
-- funil_etapa_desde: quando entrou na etapa atual (alerta de parada).
-- funil_valor_cents: valor estimado do contrato (pipeline).
-- funil_eventos: log de transições (tempo médio por etapa).

ALTER TABLE "customers" ADD COLUMN "funil_etapa_desde" TIMESTAMPTZ;
ALTER TABLE "customers" ADD COLUMN "funil_valor_cents" INTEGER;

CREATE TABLE "funil_eventos" (
    "id" BIGSERIAL NOT NULL,
    "customer_id" UUID NOT NULL,
    "de" TEXT,
    "para" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "funil_eventos_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "funil_eventos_customer_id_created_at_idx" ON "funil_eventos"("customer_id", "created_at");

ALTER TABLE "funil_eventos" ADD CONSTRAINT "funil_eventos_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
