-- CRM 2.0 F4 — fila de aprovação de mensagens. Aditiva (R11): só ADD COLUMN.
-- `texto` = mensagem final (proposta pela régua, editada pela Mi antes do envio).
-- Status ganha o valor 'aguardando' (fila) — coluna TEXT, sem enum a alterar.

ALTER TABLE "envios_mensagem" ADD COLUMN "texto" TEXT;
