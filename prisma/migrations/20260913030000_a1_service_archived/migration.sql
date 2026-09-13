-- A1 — arquivamento de serviço (soft delete).
--
-- "Excluir serviço" só aparecia nos cards sem histórico, porque a action
-- recusava quando havia bookings/turmas/fila. Na prática a Mi não conseguia
-- tirar da frente um serviço que ela não oferece mais assim que ele tivesse um
-- único atendimento — e o portal continuava oferecendo para a cliente.
--
-- `active` não resolve: ele é o liga/desliga temporário, e o serviço desativado
-- continua na lista do admin de propósito (para ela religar). Arquivar é outra
-- coisa: some de tudo, para sempre, sem perder o histórico.
--
-- Aditiva: coluna nullable, nada quebra para quem ainda não a lê.

ALTER TABLE "services" ADD COLUMN "archived_at" TIMESTAMPTZ;

-- Índice parcial: as telas quentes (catálogo do site, dropdown de encaixe,
-- lista do admin) filtram por "não arquivado" em toda consulta.
CREATE INDEX "idx_services_ativos" ON "services" ("category", "name")
  WHERE ("archived_at" IS NULL);
