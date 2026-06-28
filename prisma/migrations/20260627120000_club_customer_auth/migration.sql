-- Portal do cliente (Clube): autenticação própria da cliente. ADITIVA (R11):
-- só ADD COLUMN com default seguro em customers. Senha inicial = telefone:
-- enquanto club_password_hash é NULL e club_password_provisoria=true, o login
-- compara contra os dígitos do telefone e força a troca antes de liberar acesso.
ALTER TABLE "customers" ADD COLUMN "club_password_hash" TEXT;
ALTER TABLE "customers" ADD COLUMN "club_password_provisoria" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "customers" ADD COLUMN "club_failed_logins" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "customers" ADD COLUMN "club_locked_until" TIMESTAMPTZ;
ALTER TABLE "customers" ADD COLUMN "club_consent_at" TIMESTAMPTZ;
