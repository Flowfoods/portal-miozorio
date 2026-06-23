-- Fase 2 — foto de referência da cliente no agendamento (LGPD). Aditiva (R11).
-- photo_key = chave em storage PRIVADO (servido só via /admin/media; nunca URL
-- pública). photo_consent_at = quando a cliente autorizou o registro da imagem.

ALTER TABLE "bookings" ADD COLUMN "photo_key" TEXT;
ALTER TABLE "bookings" ADD COLUMN "photo_consent_at" TIMESTAMPTZ;
