-- M12 — Depoimentos de clientes (prova social). Aditiva (R11): só CREATE TABLE.
-- LGPD: publicar só com autorização da cliente (Anexo A).

CREATE TABLE "testimonials" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "quote" TEXT NOT NULL,
    "author" TEXT NOT NULL,
    "published" BOOLEAN NOT NULL DEFAULT true,
    "sort" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "testimonials_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "testimonials_published_idx" ON "testimonials"("published");
