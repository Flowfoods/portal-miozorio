-- B1 — login confiável em todos os browsers e domínios.
-- 100% aditiva (R11): nenhuma coluna some, nenhuma senha é invalidada e
-- ninguém é deslogado em massa (a versão começa em 0, que é o valor que os
-- cookies já emitidos assumem quando o campo `tv` não existe no payload).

-- 1) Versão do token da sessão da cliente (troca de senha derruba as outras).
ALTER TABLE "customers"
  ADD COLUMN IF NOT EXISTS "club_token_version" INTEGER NOT NULL DEFAULT 0;

-- 2) Identificador de login normalizado — e-mail sempre minúsculo e sem espaço.
--    O do painel só é reescrito quando NÃO colide com outra conta: a coluna é
--    UNIQUE e uma migration que falha derruba o boot inteiro.
UPDATE "admin_users" a
   SET "email" = lower(btrim(a."email"))
 WHERE a."email" <> lower(btrim(a."email"))
   AND NOT EXISTS (
     SELECT 1 FROM "admin_users" b
      WHERE b."id" <> a."id"
        AND b."email" = lower(btrim(a."email"))
   );

UPDATE "customers"
   SET "email" = lower(btrim("email"))
 WHERE "email" IS NOT NULL
   AND "email" <> lower(btrim("email"));

-- 3) Índice único no identificador normalizado do painel. Só é criado se não
--    houver duas contas que diferem apenas por maiúsculas — se houver, o índice
--    fica de fora e a Mi resolve o duplicado em /admin/usuarias (o UNIQUE atual
--    sobre "email" continua valendo).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM "admin_users"
     GROUP BY lower("email")
    HAVING count(*) > 1
  ) THEN
    CREATE UNIQUE INDEX IF NOT EXISTS "admin_users_email_lower_key"
      ON "admin_users" (lower("email"));
  END IF;
END $$;

-- 4) O identificador de login da CLIENTE é o telefone, que já nasce em E.164
--    (`normalizeE164BR`) e já tem UNIQUE. Aqui só garantimos que nenhuma linha
--    carrega formatação (espaço/parêntese) — de novo, sem colidir com outra.
UPDATE "customers" c
   SET "phone_e164" = '+' || regexp_replace(c."phone_e164", '\D', '', 'g')
 WHERE c."phone_e164" <> '+' || regexp_replace(c."phone_e164", '\D', '', 'g')
   AND NOT EXISTS (
     SELECT 1 FROM "customers" d
      WHERE d."id" <> c."id"
        AND d."phone_e164" = '+' || regexp_replace(c."phone_e164", '\D', '', 'g')
   );

-- Busca por e-mail da cliente (ficha no painel) sem depender de case.
CREATE INDEX IF NOT EXISTS "customers_email_lower_idx"
  ON "customers" (lower("email"));
