-- Central de Campanhas (F2). Aditiva.

CREATE TABLE "campanha" (
  "id"                    UUID NOT NULL DEFAULT gen_random_uuid(),
  "nome"                  TEXT NOT NULL,
  "tipo"                  TEXT NOT NULL,
  "status"                TEXT NOT NULL DEFAULT 'RASCUNHO',
  "segmento_config"       JSONB NOT NULL,
  "corpo"                 TEXT NOT NULL,
  "agendada_para"         TIMESTAMPTZ,
  "recorrencia"           TEXT,
  "modo_aprovacao"        BOOLEAN NOT NULL DEFAULT true,
  "janela_conversao_dias" INTEGER NOT NULL DEFAULT 7,
  "criado_em"             TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "campanha_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "campanha_tipo_status_idx" ON "campanha" ("tipo", "status");

CREATE TABLE "campanha_template" (
  "id"        UUID NOT NULL DEFAULT gen_random_uuid(),
  "nome"      TEXT NOT NULL,
  "corpo"     TEXT NOT NULL,
  "criado_em" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "campanha_template_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "campanha_envio" (
  "id"                  UUID NOT NULL DEFAULT gen_random_uuid(),
  "campanha_id"         UUID NOT NULL,
  "cliente_id"          UUID NOT NULL,
  "whatsapp_message_id" UUID,
  "convertido_em"       TIMESTAMPTZ,
  "receita_cents"       INTEGER,
  "criado_em"           TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "campanha_envio_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "campanha_envio_campanha_id_fkey" FOREIGN KEY ("campanha_id")
    REFERENCES "campanha" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "campanha_envio_camp_cli_key" ON "campanha_envio" ("campanha_id", "cliente_id");
CREATE INDEX "campanha_envio_campanha_idx" ON "campanha_envio" ("campanha_id");
