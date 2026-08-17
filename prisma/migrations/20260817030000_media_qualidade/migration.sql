-- BUG D (fotos): original preservado + metadados de entrega.
-- 100% aditiva (R11): colunas novas e opcionais em media_assets.
ALTER TABLE "media_assets" ADD COLUMN IF NOT EXISTS "orig_url" TEXT;
ALTER TABLE "media_assets" ADD COLUMN IF NOT EXISTS "width" INTEGER;
ALTER TABLE "media_assets" ADD COLUMN IF NOT EXISTS "height" INTEGER;
ALTER TABLE "media_assets" ADD COLUMN IF NOT EXISTS "blur_data" TEXT;
