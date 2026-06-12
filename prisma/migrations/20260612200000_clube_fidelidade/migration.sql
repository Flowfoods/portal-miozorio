-- Clube de Fidelidade & Indicação — motor de indicação + ciclo de vida.
-- Aditiva (R11): só ADD COLUMN / CREATE TABLE / INSERT idempotente.
--
-- Decisão de arquitetura: NÃO existe tabela "clube_membros". Uma pessoa = um
-- registro em customers (WhatsApp E.164 único, LGPD, alergias da M11); as
-- "ocasiões" são os bookings completed, já auditados (R17). O clube é uma
-- extensão do cliente + duas tabelas novas (marcos da escada e brindes).

-- Extensão de customers
ALTER TABLE "customers" ADD COLUMN "referral_code" TEXT;
ALTER TABLE "customers" ADD COLUMN "referred_by_id" UUID;
ALTER TABLE "customers" ADD COLUMN "club_joined_at" TIMESTAMPTZ;
ALTER TABLE "customers" ADD COLUMN "club_interest" TEXT;

CREATE UNIQUE INDEX "customers_referral_code_key" ON "customers"("referral_code");
CREATE INDEX "customers_referred_by_id_idx" ON "customers"("referred_by_id");

ALTER TABLE "customers" ADD CONSTRAINT "customers_referred_by_id_fkey"
    FOREIGN KEY ("referred_by_id") REFERENCES "customers"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- Marcos da escada de indicação (1ª/3ª/5ª indicada que realizou atendimento).
-- UNIQUE (customer_id, nivel) = idempotência do gatilho (R10): o marco só
-- nasce uma vez por nível, não importa quantas vezes o hook rode.
CREATE TABLE "referral_milestones" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "customer_id" UUID NOT NULL,
    "nivel" INTEGER NOT NULL,
    "beneficio" TEXT NOT NULL,
    "liberado_em" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resgatado_em" TIMESTAMPTZ,

    CONSTRAINT "referral_milestones_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "referral_milestones_customer_id_fkey"
        FOREIGN KEY ("customer_id") REFERENCES "customers"("id")
        ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "referral_milestones_customer_id_nivel_key"
    ON "referral_milestones"("customer_id", "nivel");

-- Brindes entregues fora da escada (aniversário, cortesias) — registro da Mi.
CREATE TABLE "club_redemptions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "customer_id" UUID NOT NULL,
    "beneficio" TEXT NOT NULL,
    "origem" TEXT NOT NULL DEFAULT 'manual',
    "resgatado_em" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "club_redemptions_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "club_redemptions_customer_id_fkey"
        FOREIGN KEY ("customer_id") REFERENCES "customers"("id")
        ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "club_redemptions_customer_id_idx" ON "club_redemptions"("customer_id");

-- Escada configurável em business_settings (R3, zero hardcode). Os textos dos
-- benefícios são rascunho A CONFIRMAR COM A MI — nunca inventamos valor em R$.
INSERT INTO "business_settings" ("key", "value", "updatedAt") VALUES (
    'club_ladder',
    '[{"nivel":1,"beneficio":"Design de sobrancelha cortesia na sua próxima visita (a confirmar com a Mi)"},{"nivel":3,"beneficio":"Condição especial na sua próxima maquiagem social (a confirmar com a Mi)"},{"nivel":5,"beneficio":"Maquiagem cortesia para uma ocasião sua (combinar direto com a Mi)"}]'::jsonb,
    CURRENT_TIMESTAMP
) ON CONFLICT ("key") DO NOTHING;
