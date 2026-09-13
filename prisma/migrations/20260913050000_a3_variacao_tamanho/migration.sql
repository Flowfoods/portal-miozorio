-- A3 — variação por tamanho (escova cabelo curto/médio/longo…).
--
-- ⚠️ DECISÃO DE PROJETO: "aguardando validação de tamanho" é FLAG, não status.
--
-- O pedido original era um BookingStatus novo. Mas a trava anti-double-booking
-- é parcial:
--     EXCLUDE USING gist (...) WHERE (status IN ('pending','confirmed'))
-- e o índice de disponibilidade usa o mesmo recorte. Um status novo cairia
-- FORA dos dois: o horário deixaria de ser protegido contra sobreposição e
-- sumiria das consultas de disponibilidade — um furo silencioso na R2, que é
-- inviolável. Manter o booking em `pending` com uma flag preserva as duas
-- garantias e ainda dá o rótulo próprio na tela.

-- Variações de um serviço. Sem linhas = serviço normal, comportamento idêntico
-- ao de hoje (retrocompatível por construção).
CREATE TABLE "service_variants" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "service_id" UUID NOT NULL,
    "nome" TEXT NOT NULL,
    "price_cents" INTEGER NOT NULL,
    "price_home_cents" INTEGER,
    "duration_min" INTEGER,
    "sort" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT "service_variants_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "service_variants"
  ADD CONSTRAINT "service_variants_service_id_fkey"
  FOREIGN KEY ("service_id") REFERENCES "services"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "idx_service_variants_servico" ON "service_variants" ("service_id", "sort");

-- Preço e duração precisam fazer sentido, senão uma variação com duração 0
-- geraria um agendamento de comprimento zero e quebraria o motor.
ALTER TABLE "service_variants"
  ADD CONSTRAINT "service_variants_valores_validos"
  CHECK ("price_cents" >= 0 AND ("duration_min" IS NULL OR "duration_min" > 0));

-- Booking: qual tamanho a cliente escolheu e se a Mi já validou.
ALTER TABLE "bookings" ADD COLUMN "variant_id" UUID;
ALTER TABLE "bookings" ADD COLUMN "size_approved_at" TIMESTAMPTZ;
ALTER TABLE "bookings" ADD COLUMN "size_adjust_reason" TEXT;

ALTER TABLE "bookings"
  ADD CONSTRAINT "bookings_variant_id_fkey"
  FOREIGN KEY ("variant_id") REFERENCES "service_variants"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "idx_bookings_aguardando_tamanho" ON "bookings" ("starts_at")
  WHERE ("variant_id" IS NOT NULL AND "size_approved_at" IS NULL);
