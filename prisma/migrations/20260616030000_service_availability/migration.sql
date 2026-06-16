-- M9 — Disponibilidade própria por serviço (linha Dia a Dia).
-- Aditiva (R11): só CREATE TABLE. Serviço sem linhas aqui = usa o working_hours
-- global (retrocompatível com social/noiva/curso).

CREATE TABLE "service_availability" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "service_id" UUID NOT NULL,
    "weekday" INTEGER NOT NULL,
    "start_time" TEXT NOT NULL,
    "end_time" TEXT NOT NULL,

    CONSTRAINT "service_availability_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "service_availability_service_id_fkey"
        FOREIGN KEY ("service_id") REFERENCES "services"("id")
        ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "service_availability_service_id_idx" ON "service_availability"("service_id");
