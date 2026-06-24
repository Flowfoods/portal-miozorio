-- CRM (Matriz RFV + Jornadas + funil de noiva). Aditiva (R11): CREATE TYPE /
-- ADD COLUMN / CREATE TABLE. Não toca dados nem o agendamento existente.

-- Funil de noiva/debutante (avanço manual; nunca agendável online — R14).
CREATE TYPE "FunilEtapa" AS ENUM ('lead', 'previa_agendada', 'previa_feita', 'contrato_fechado', 'evento', 'pos_evento');

-- Extensão da ficha do cliente: CRM + campos calculados do RFV.
ALTER TABLE "customers" ADD COLUMN "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "customers" ADD COLUMN "origem" TEXT;
ALTER TABLE "customers" ADD COLUMN "whatsapp_opt_in" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "customers" ADD COLUMN "whatsapp_opt_in_at" TIMESTAMPTZ;
ALTER TABLE "customers" ADD COLUMN "funil_etapa" "FunilEtapa";
ALTER TABLE "customers" ADD COLUMN "r_score" INTEGER;
ALTER TABLE "customers" ADD COLUMN "f_score" INTEGER;
ALTER TABLE "customers" ADD COLUMN "v_score" INTEGER;
ALTER TABLE "customers" ADD COLUMN "rfv_segmento" TEXT;
ALTER TABLE "customers" ADD COLUMN "ltv_previsto_cents" INTEGER;
ALTER TABLE "customers" ADD COLUMN "rfv_calculado_em" TIMESTAMPTZ;
CREATE INDEX "customers_rfv_segmento_idx" ON "customers"("rfv_segmento");

-- Jornadas (fluxos automáticos por comportamento).
CREATE TABLE "jornadas" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "nome" TEXT NOT NULL,
    "gatilho" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT false,
    "descricao" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "jornadas_pkey" PRIMARY KEY ("id")
);

-- Etapas (passos) de cada jornada.
CREATE TABLE "jornada_etapas" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "jornada_id" UUID NOT NULL,
    "ordem" INTEGER NOT NULL,
    "espera_horas" INTEGER NOT NULL DEFAULT 0,
    "template_key" TEXT,
    "template" TEXT,
    "condicao" TEXT,
    CONSTRAINT "jornada_etapas_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "jornada_etapas_jornada_id_fkey"
        FOREIGN KEY ("jornada_id") REFERENCES "jornadas"("id")
        ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "jornada_etapas_jornada_id_idx" ON "jornada_etapas"("jornada_id");

-- Auditoria de disparo (jornadas/CRM). dedup_key único = idempotência (R10).
CREATE TABLE "envios_mensagem" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "customer_id" UUID NOT NULL,
    "jornada_id" UUID,
    "etapa_id" UUID,
    "canal" TEXT NOT NULL DEFAULT 'whatsapp',
    "kind" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pendente',
    "erro" TEXT,
    "dedup_key" TEXT,
    "agendado_em" TIMESTAMPTZ,
    "enviado_em" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "envios_mensagem_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "envios_mensagem_customer_id_fkey"
        FOREIGN KEY ("customer_id") REFERENCES "customers"("id")
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "envios_mensagem_jornada_id_fkey"
        FOREIGN KEY ("jornada_id") REFERENCES "jornadas"("id")
        ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "envios_mensagem_dedup_key_key" ON "envios_mensagem"("dedup_key");
CREATE INDEX "envios_mensagem_customer_id_idx" ON "envios_mensagem"("customer_id");
CREATE INDEX "envios_mensagem_status_idx" ON "envios_mensagem"("status");

-- Cadência da jornada de manutenção (dias). Default 60 — A CONFIRMAR COM A MI.
INSERT INTO "business_settings" ("key", "value", "updatedAt")
VALUES ('jornada_manutencao_dias', '60'::jsonb, CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO NOTHING;
