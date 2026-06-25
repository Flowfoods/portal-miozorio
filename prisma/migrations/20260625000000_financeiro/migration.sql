-- Módulo Financeiro — Centro de custos + Receita (booking/manual) + DRE mensal.
-- ADITIVA (R11): só CREATE TYPE/TABLE/INDEX e 1 FK aditiva em bookings via
-- revenue_entries (a coluna FK vive em revenue_entries, bookings não muda).
-- Valores em centavos (Int). Competência em DATE; caixa em TIMESTAMPTZ.

-- ── Enums ───────────────────────────────────────────────────────────────────
CREATE TYPE "FinancialKind" AS ENUM ('expense', 'revenue');
CREATE TYPE "CostNature" AS ENUM ('fixed', 'variable');
CREATE TYPE "DreGroup" AS ENUM ('deducao_venda', 'custo_variavel', 'custo_fixo', 'pro_labore');
CREATE TYPE "RevenueSource" AS ENUM ('booking', 'manual');

-- ── financial_categories ────────────────────────────────────────────────────
CREATE TABLE "financial_categories" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "FinancialKind" NOT NULL,
    "nature" "CostNature",
    "dre_group" "DreGroup",
    "is_cmv" BOOLEAN NOT NULL DEFAULT false,
    "color" TEXT NOT NULL DEFAULT '#8A7361',
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "sort" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "financial_categories_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "financial_categories_code_key" ON "financial_categories"("code");
CREATE INDEX "financial_categories_kind_active_idx" ON "financial_categories"("kind", "active");

-- ── recurring_costs ─────────────────────────────────────────────────────────
CREATE TABLE "recurring_costs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "category_id" UUID NOT NULL,
    "description" TEXT NOT NULL,
    "amount_cents" INTEGER NOT NULL,
    "day_of_month" INTEGER NOT NULL,
    "payment_method" TEXT,
    "supplier" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recurring_costs_pkey" PRIMARY KEY ("id")
);

-- ── expenses ────────────────────────────────────────────────────────────────
CREATE TABLE "expenses" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "category_id" UUID NOT NULL,
    "description" TEXT NOT NULL,
    "amount_cents" INTEGER NOT NULL,
    "competence_date" DATE NOT NULL,
    "paid_at" TIMESTAMPTZ,
    "payment_method" TEXT,
    "supplier" TEXT,
    "is_recurring" BOOLEAN NOT NULL DEFAULT false,
    "recurring_id" UUID,
    "notes" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "expenses_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "expenses_competence_date_idx" ON "expenses"("competence_date");
CREATE INDEX "expenses_category_id_idx" ON "expenses"("category_id");
CREATE INDEX "expenses_recurring_id_competence_date_idx" ON "expenses"("recurring_id", "competence_date");

-- ── revenue_entries ─────────────────────────────────────────────────────────
CREATE TABLE "revenue_entries" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "category_id" UUID,
    "description" TEXT NOT NULL,
    "amount_cents" INTEGER NOT NULL,
    "competence_date" DATE NOT NULL,
    "received_at" TIMESTAMPTZ,
    "source" "RevenueSource" NOT NULL DEFAULT 'manual',
    "booking_id" UUID,
    "customer_name" TEXT,
    "payment_method" TEXT,
    "card_fee_cents" INTEGER,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "revenue_entries_pkey" PRIMARY KEY ("id")
);
-- Idempotência da receita de booking (1:1). NULLs são distintos no Postgres,
-- então lançamentos manuais (booking_id NULL) convivem livremente.
CREATE UNIQUE INDEX "revenue_entries_booking_id_key" ON "revenue_entries"("booking_id");
CREATE INDEX "revenue_entries_competence_date_idx" ON "revenue_entries"("competence_date");
CREATE INDEX "revenue_entries_category_id_idx" ON "revenue_entries"("category_id");

-- ── attachments ─────────────────────────────────────────────────────────────
CREATE TABLE "attachments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "file_path" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "expense_id" UUID,
    "revenue_id" UUID,
    "uploaded_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attachments_pkey" PRIMARY KEY ("id"),
    -- Exatamente um dono: ou despesa, ou receita (nunca ambos, nunca nenhum).
    CONSTRAINT "attachments_one_owner" CHECK (("expense_id" IS NOT NULL) <> ("revenue_id" IS NOT NULL))
);
CREATE INDEX "attachments_expense_id_idx" ON "attachments"("expense_id");
CREATE INDEX "attachments_revenue_id_idx" ON "attachments"("revenue_id");

-- ── Foreign keys ────────────────────────────────────────────────────────────
ALTER TABLE "recurring_costs" ADD CONSTRAINT "recurring_costs_category_id_fkey"
    FOREIGN KEY ("category_id") REFERENCES "financial_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "expenses" ADD CONSTRAINT "expenses_category_id_fkey"
    FOREIGN KEY ("category_id") REFERENCES "financial_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_recurring_id_fkey"
    FOREIGN KEY ("recurring_id") REFERENCES "recurring_costs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "revenue_entries" ADD CONSTRAINT "revenue_entries_category_id_fkey"
    FOREIGN KEY ("category_id") REFERENCES "financial_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "revenue_entries" ADD CONSTRAINT "revenue_entries_booking_id_fkey"
    FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "attachments" ADD CONSTRAINT "attachments_expense_id_fkey"
    FOREIGN KEY ("expense_id") REFERENCES "expenses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_revenue_id_fkey"
    FOREIGN KEY ("revenue_id") REFERENCES "revenue_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;
