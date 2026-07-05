-- CRM 2.0 F2 — régua RFV editável (crm_config). Aditiva (R11): só CREATE TABLE.
-- Tabela versionada: cada salvamento insere uma linha; a mais recente vige e o
-- histórico (quem/quando/de→para) é a própria tabela. Sem linha = defaults do
-- código (DEFAULT_CRM_CONFIG), que reproduzem a segmentação anterior.

CREATE TABLE "crm_config" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "config" JSONB NOT NULL,
    "criado_por" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "crm_config_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "crm_config_created_at_idx" ON "crm_config"("created_at");
