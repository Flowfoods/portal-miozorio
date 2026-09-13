-- A7 (conclusão) — cobrança do sinal pelo portal.
--
-- `deposit_paid_at` já existia e nunca era preenchido por nenhum caminho do
-- código: era exatamente isso que tornava "Exige sinal" um beco sem saída.
-- Estas colunas guardam QUEM cobrou e QUAL cobrança, para conciliar depois e
-- para o webhook achar a reserva.
--
-- Aditiva: tudo nullable. Sem gateway configurado nada é escrito aqui e o
-- portal segue no caminho do WhatsApp.

ALTER TABLE "bookings" ADD COLUMN "deposit_provider" TEXT;
ALTER TABLE "bookings" ADD COLUMN "deposit_payment_id" TEXT;

-- O webhook chega com o id da cobrança e precisa achar a reserva por ele.
-- Único: uma cobrança pertence a um agendamento só.
CREATE UNIQUE INDEX "idx_bookings_deposit_payment"
  ON "bookings" ("deposit_payment_id")
  WHERE ("deposit_payment_id" IS NOT NULL);

-- Conciliação: cobranças ainda em aberto (o cron de verificação varre estas).
CREATE INDEX "idx_bookings_sinal_pendente" ON "bookings" ("starts_at")
  WHERE ("deposit_payment_id" IS NOT NULL AND "deposit_paid_at" IS NULL);
