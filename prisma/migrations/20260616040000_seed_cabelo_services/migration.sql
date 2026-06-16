-- M9 (fix) — Insere os serviços da linha Cabelo no banco de produção.
-- A seed roda com --if-empty (não semeia banco já populado, p/ não sobrescrever
-- ajustes da Mi), então serviços novos não entram via seed num DB existente.
-- Aditiva e idempotente (R11): ON CONFLICT (code) DO NOTHING.
-- Preços/durações A CONFIRMAR COM A MI (pending_price = true).

INSERT INTO "services"
  ("code", "name", "category", "duration_min", "buffer_min", "price_cents", "price_home_cents", "bookable_online", "pending_price")
VALUES
  ('escova',             'Escova',             'cabelo', 60, 15, 0, NULL, true, true),
  ('hidratacao',         'Hidratação',         'cabelo', 60, 15, 0, NULL, true, true),
  ('reconstrucao',       'Reconstrução',       'cabelo', 90, 15, 0, NULL, true, true),
  ('cronograma-capilar', 'Cronograma capilar', 'cabelo', 90, 15, 0, NULL, true, true)
ON CONFLICT ("code") DO NOTHING;
