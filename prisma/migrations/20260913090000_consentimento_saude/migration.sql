-- Consentimento ESPECÍFICO para dado de saúde (alergia) — R6/R18.
--
-- A alergia era coletada no formulário público sob o mesmo checkbox genérico
-- "Li e aceito a política de privacidade". A LGPD trata dado de saúde como
-- sensível (art. 5º, II) e exige consentimento "específico e destacado, para
-- finalidades específicas" (art. 11, I) — um aceite genérico não cobre.
--
-- O armazenamento e o acesso já estavam corretos (só painel autenticado). O que
-- faltava era o registro de que a pessoa consentiu NAQUELE dado, separadamente.
--
-- Aditiva (R11): coluna nova, nulável, sem default de escrita. Reservas
-- existentes ficam com NULL — que é a verdade: elas não têm esse consentimento
-- registrado, e inventar um carimbo de data seria falsificar auditoria de LGPD.
ALTER TABLE "bookings"
  ADD COLUMN IF NOT EXISTS "health_consent_at" TIMESTAMPTZ;

COMMENT ON COLUMN "bookings"."health_consent_at" IS
  'Consentimento especifico para o dado de saude da anamnese (alergia). NULL = nao consentido/nao coletado.';
