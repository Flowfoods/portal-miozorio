-- Indicação PERCENTUAL no Clube (substitui a pontuação fixa). Mudança ADITIVA:
-- nada é removido/renomeado (R11). Créditos fixos já concedidos permanecem
-- intocados no histórico; o motivo antigo "referral" segue como legado de leitura.

-- Snapshot auditável do lançamento (percentual vigente, base, bookingId, indicadaId,
-- estorno...). Nullable: lançamentos legados ficam com meta = NULL.
ALTER TABLE "club_transactions"
  ADD COLUMN "meta" JSONB;

-- Configuração da regra (business_settings). Só cria se ainda não existir —
-- nunca sobrescreve um valor que a Mi já tenha ajustado no admin.
INSERT INTO "business_settings" ("key", "value", "updatedAt") VALUES
  ('club_referral_percent', '20'::jsonb, now()),
  ('club_referral_scope', '"PRIMEIRO_ATENDIMENTO"'::jsonb, now()),
  ('club_referral_active', 'true'::jsonb, now())
ON CONFLICT ("key") DO NOTHING;
