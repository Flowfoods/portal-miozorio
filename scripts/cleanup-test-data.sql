-- M8.3 — Limpeza dos dados de teste deixados em produção (idempotente).
-- Remove os clientes de teste e TUDO que está vinculado a eles
-- (agendamentos, eventos de auditoria, notificações, fila de espera).
--
-- Clientes-alvo (identificados pelo telefone, que é único):
--   +5521998880001  "Teste Corrida 1"        (teste de corrida M1.5#3)
--   +5521998880002  "Teste Corrida 2"        (teste de corrida M1.5#3)
--   +5521998880003  "Cliente Demonstração"   (demo do painel, sessão 5b)
--
-- ⚠️ NUNCA rodar sem backup confirmado (gate do M8.3):
--   1. Backup:  docker exec <pg-miozorio> pg_dump -U miozorio -d miozorio \
--                 > backup-pre-m83-$(date +%Y%m%d-%H%M).sql
--   2. Rodar:   docker exec -i <pg-miozorio> psql -U miozorio -d miozorio \
--                 -v ON_ERROR_STOP=1 < scripts/cleanup-test-data.sql
--
-- Idempotente: rodar de novo apaga 0 linhas e termina limpo.

BEGIN;

CREATE TEMP TABLE _test_customers ON COMMIT DROP AS
  SELECT id FROM customers
  WHERE phone_e164 IN ('+5521998880001', '+5521998880002', '+5521998880003');

CREATE TEMP TABLE _test_bookings ON COMMIT DROP AS
  SELECT id FROM bookings
  WHERE customer_id IN (SELECT id FROM _test_customers);

-- Relatório do que será removido (conferir antes do COMMIT se rodar manual)
SELECT
  (SELECT count(*) FROM _test_customers)                                            AS clientes,
  (SELECT count(*) FROM _test_bookings)                                             AS agendamentos,
  (SELECT count(*) FROM booking_events    WHERE booking_id IN (SELECT id FROM _test_bookings)) AS eventos,
  (SELECT count(*) FROM notification_log  WHERE booking_id IN (SELECT id FROM _test_bookings)) AS notificacoes,
  (SELECT count(*) FROM waitlist          WHERE customer_id IN (SELECT id FROM _test_customers)) AS fila_espera;

DELETE FROM booking_events   WHERE booking_id  IN (SELECT id FROM _test_bookings);
DELETE FROM notification_log WHERE booking_id  IN (SELECT id FROM _test_bookings);
DELETE FROM bookings         WHERE id          IN (SELECT id FROM _test_bookings);
DELETE FROM waitlist         WHERE customer_id IN (SELECT id FROM _test_customers);
DELETE FROM customers        WHERE id          IN (SELECT id FROM _test_customers);

COMMIT;
