-- F1 Área da Cliente — extensão ADITIVA de testimonials + fotos de depoimento.
-- Nada é removido/renomeado (R11). Linhas legadas (criadas pela Mi no admin)
-- recebem status derivado de `published` e origem 'admin'.

ALTER TABLE "testimonials"
  ADD COLUMN "customer_id" UUID,
  ADD COLUMN "booking_id" UUID,
  ADD COLUMN "rating" INTEGER,
  ADD COLUMN "status" TEXT NOT NULL DEFAULT 'pendente',
  ADD COLUMN "motivo_rejeicao" TEXT,
  ADD COLUMN "consentimento_publico_at" TIMESTAMPTZ,
  ADD COLUMN "destaque" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "origem" TEXT NOT NULL DEFAULT 'admin',
  ADD COLUMN "enviado_em" TIMESTAMPTZ,
  ADD COLUMN "moderado_em" TIMESTAMPTZ,
  ADD COLUMN "moderado_por" TEXT;

-- Backfill do legado: publicado = aprovado; despublicado = arquivado.
UPDATE "testimonials"
SET "status" = CASE WHEN "published" THEN 'aprovado' ELSE 'arquivado' END;

ALTER TABLE "testimonials"
  ADD CONSTRAINT "testimonials_customer_id_fkey"
    FOREIGN KEY ("customer_id") REFERENCES "customers"("id")
    ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "testimonials_booking_id_fkey"
    FOREIGN KEY ("booking_id") REFERENCES "bookings"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "testimonials_customer_id_idx" ON "testimonials"("customer_id");
CREATE INDEX "testimonials_status_idx" ON "testimonials"("status");

-- Fotos de depoimento: arquivo no store PRIVADO (priv/), nunca em /media.
CREATE TABLE "testimonial_photos" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "testimonial_id" UUID NOT NULL,
  "file_key" TEXT NOT NULL,
  "ordem" INTEGER NOT NULL DEFAULT 0,
  "aprovada" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT "testimonial_photos_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "testimonial_photos_testimonial_id_fkey"
    FOREIGN KEY ("testimonial_id") REFERENCES "testimonials"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "testimonial_photos_testimonial_id_idx"
  ON "testimonial_photos"("testimonial_id");
