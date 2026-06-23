-- Fase 1 multi-serviço — itens do agendamento. Aditiva (R11): só CREATE TABLE.
-- booking.service_id/price_cents seguem como primário/total (retrocompat); os
-- itens guardam serviço + duração + preço de tabela + preço cobrado + motivo.

CREATE TABLE "booking_items" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "booking_id" UUID NOT NULL,
    "service_id" UUID NOT NULL,
    "duration_min" INTEGER NOT NULL,
    "price_tabela_cents" INTEGER NOT NULL,
    "price_cobrado_cents" INTEGER NOT NULL,
    "motivo_ajuste" TEXT,
    "sort" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "booking_items_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "booking_items_booking_id_idx" ON "booking_items"("booking_id");

ALTER TABLE "booking_items"
    ADD CONSTRAINT "booking_items_booking_id_fkey"
    FOREIGN KEY ("booking_id") REFERENCES "bookings"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "booking_items"
    ADD CONSTRAINT "booking_items_service_id_fkey"
    FOREIGN KEY ("service_id") REFERENCES "services"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
