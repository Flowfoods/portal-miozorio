-- Clube por PONTOS (Anexo 1). Aditiva (R11): ADD COLUMN / CREATE TABLE / INSERT
-- idempotente. Convive com o clube de indicação atual (tabelas antigas ficam).

-- Pontos por atendimento, por tipo de serviço (configurável pela Mi).
ALTER TABLE "services" ADD COLUMN "club_points" INTEGER NOT NULL DEFAULT 0;

-- Catálogo de recompensas (prêmio | serviço), custo em pontos.
CREATE TABLE "club_rewards" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "nome" TEXT NOT NULL,
    "tipo" TEXT NOT NULL DEFAULT 'premio',
    "custo_pontos" INTEGER NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "sort" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "club_rewards_pkey" PRIMARY KEY ("id")
);

-- Extrato auditável. Saldo = SUM(pontos). dedup_key único = crédito idempotente.
CREATE TABLE "club_transactions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "customer_id" UUID NOT NULL,
    "pontos" INTEGER NOT NULL,
    "tipo" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "dedup_key" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "club_transactions_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "club_transactions_customer_id_fkey"
        FOREIGN KEY ("customer_id") REFERENCES "customers"("id")
        ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "club_transactions_dedup_key_key" ON "club_transactions"("dedup_key");
CREATE INDEX "club_transactions_customer_id_idx" ON "club_transactions"("customer_id");

-- Pontos por indicação concretizada (configurável). Default 100 — A CONFIRMAR COM A MI.
INSERT INTO "business_settings" ("key", "value", "updatedAt")
VALUES ('club_points_per_referral', '100'::jsonb, CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO NOTHING;
