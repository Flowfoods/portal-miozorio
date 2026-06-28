-- Resgate self-service do Clube: voucher com código + status. ADITIVA (R11):
-- só CREATE TABLE nova. O débito de pontos continua no ledger (club_transactions);
-- o voucher é o registro de fulfillment (solicitado → entregue).
CREATE TABLE "club_vouchers" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "customer_id" UUID NOT NULL,
    "reward_id" UUID,
    "reward_nome" TEXT NOT NULL,
    "custo_pontos" INTEGER NOT NULL,
    "codigo" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'solicitado',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "entregue_at" TIMESTAMPTZ,

    CONSTRAINT "club_vouchers_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "club_vouchers_customer_id_fkey"
        FOREIGN KEY ("customer_id") REFERENCES "customers"("id")
        ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "club_vouchers_reward_id_fkey"
        FOREIGN KEY ("reward_id") REFERENCES "club_rewards"("id")
        ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "club_vouchers_codigo_key" ON "club_vouchers"("codigo");
CREATE INDEX "club_vouchers_customer_id_idx" ON "club_vouchers"("customer_id");
CREATE INDEX "club_vouchers_status_idx" ON "club_vouchers"("status");
