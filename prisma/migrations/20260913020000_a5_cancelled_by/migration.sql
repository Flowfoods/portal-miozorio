-- A5 — separa QUEM encerrou o agendamento do status.
--
-- O enum BookingStatus não tem "expired", então expireStaleHolds gravava
-- `cancelled_by_business` — o mesmo status de quando a Mi cancela de verdade.
-- A tela então acusava a Mi ("Cancelado (Mi)") de cancelamentos feitos pelo
-- cron. A prova do contrário sempre esteve em booking_events (actor='system'),
-- mas ler evento para desenhar uma pílula de status é caro e frágil.
--
-- Coluna nova, nullable, aditiva: nada quebra para quem não a lê ainda.

CREATE TYPE "CancelledBy" AS ENUM ('SYSTEM', 'CLIENT', 'ADMIN');

ALTER TABLE "bookings" ADD COLUMN "cancelled_by" "CancelledBy";

-- Backfill a partir da auditoria que já existia, para o histórico também parar
-- de acusar a Mi. Usa o ÚLTIMO evento de cancelamento de cada booking.
WITH ultimo AS (
  SELECT DISTINCT ON (be.booking_id)
         be.booking_id,
         be.actor,
         be.reason
    FROM booking_events be
   WHERE be.to_status IN ('cancelled_by_business', 'cancelled_by_client')
   ORDER BY be.booking_id, be.created_at DESC, be.id DESC
)
UPDATE bookings b
   SET cancelled_by = CASE
         WHEN u.actor = 'system' THEN 'SYSTEM'::"CancelledBy"
         WHEN u.actor IN ('customer', 'client') THEN 'CLIENT'::"CancelledBy"
         ELSE 'ADMIN'::"CancelledBy"
       END
  FROM ultimo u
 WHERE b.id = u.booking_id
   AND b.status IN ('cancelled_by_business', 'cancelled_by_client');

-- Cancelamentos antigos sem evento registrado: deduz do próprio status, que é
-- o melhor que se pode afirmar sem inventar.
UPDATE bookings
   SET cancelled_by = 'CLIENT'::"CancelledBy"
 WHERE cancelled_by IS NULL AND status = 'cancelled_by_client';

UPDATE bookings
   SET cancelled_by = 'ADMIN'::"CancelledBy"
 WHERE cancelled_by IS NULL AND status = 'cancelled_by_business';
