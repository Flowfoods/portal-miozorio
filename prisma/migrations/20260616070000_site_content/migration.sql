-- CMS leve (Onda B). Aditiva (R11): só CREATE TABLE. Default dos textos mora no
-- código (registry); a linha aqui é só o override editado pela Mi.

CREATE TABLE "site_content" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "site_content_pkey" PRIMARY KEY ("key")
);
