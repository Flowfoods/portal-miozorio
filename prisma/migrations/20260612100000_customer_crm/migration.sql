-- M11: ficha da cliente (CRM) — alergia persistente, anotações privadas da Mi
-- e consentimento de uso de foto (LGPD, R6/R18).
-- Aditiva (R11): só ADD COLUMN, nada existente é tocado.
ALTER TABLE "customers" ADD COLUMN "allergies" TEXT;
ALTER TABLE "customers" ADD COLUMN "notes" TEXT;
ALTER TABLE "customers" ADD COLUMN "photo_consent" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "customers" ADD COLUMN "photo_consent_at" TIMESTAMPTZ;
