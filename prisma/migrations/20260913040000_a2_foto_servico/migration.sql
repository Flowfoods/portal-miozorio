-- A2 — foto de exemplo por serviço (o cardápio visual).
--
-- Reusa `media_assets` (que já tem category='servico', WebP, blur placeholder e
-- dimensões) em vez de criar uma coluna de URL solta: assim a foto do serviço
-- herda o pipeline inteiro — original preservado, master q90, blur sem layout
-- shift — e some junto se o asset for apagado.
--
-- Aditiva: coluna nullable com ON DELETE SET NULL. Serviço sem foto continua
-- caindo no MonogramPlaceholder, que já era o fallback do portal.

ALTER TABLE "services" ADD COLUMN "media_asset_id" UUID;

ALTER TABLE "services"
  ADD CONSTRAINT "services_media_asset_id_fkey"
  FOREIGN KEY ("media_asset_id") REFERENCES "media_assets"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "idx_services_media_asset" ON "services" ("media_asset_id");
