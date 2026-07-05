-- Auth F1.2 — auditoria de autenticação + invalidação de sessão do admin.

-- Invalidação de todas as sessões JWT do admin ao trocar a senha: o token
-- carrega token_version; ao redefinir a senha o número sobe e os JWTs antigos
-- deixam de validar. Aditiva (default 0 — sessões atuais seguem válidas).
ALTER TABLE "admin_users" ADD COLUMN "token_version" INTEGER NOT NULL DEFAULT 0;

-- Log de auditoria de autenticação dos dois portais. Sem PII sensível:
-- IP hasheado, telefone da cliente mascarado, nunca senha/token/código.
CREATE TABLE "auth_log" (
  "id"          BIGSERIAL PRIMARY KEY,
  "area"        TEXT NOT NULL,
  "event"       TEXT NOT NULL,
  "identifier"  TEXT,
  "ip_hash"     TEXT,
  "user_agent"  TEXT,
  "created_at"  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Leitura no painel (por área/evento, mais recentes primeiro).
CREATE INDEX "auth_log_area_event_created_at_idx" ON "auth_log" ("area", "event", "created_at");
-- Rate-limit por IP (falhas recentes de um mesmo ip_hash).
CREATE INDEX "auth_log_ip_hash_created_at_idx" ON "auth_log" ("ip_hash", "created_at");
