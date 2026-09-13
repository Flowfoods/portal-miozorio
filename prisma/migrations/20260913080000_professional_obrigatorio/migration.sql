-- professional_id obrigatório — fecha a R2 por ESTRUTURA, não por disciplina.
--
-- A trava anti-double-booking é:
--     EXCLUDE USING gist ("professional_id" WITH =, tstzrange(...) WITH &&)
-- e em PostgreSQL `NULL = NULL` não é verdadeiro — é NULL. Logo, duas reservas
-- com profissional NULL no mesmo horário NÃO conflitam: a trava não dispara e o
-- horário fica desprotegido, em silêncio. Nenhum erro, nenhum log, nada.
--
-- Hoje nenhum caminho do app grava NULL (`ensureProfessional()` em
-- booking-service.ts), mas isso é o app se comportando bem — não é o banco
-- impedindo. Enquanto a coluna aceitar NULL, um script, um INSERT manual ou um
-- caminho novo reabrem o buraco sem avisar.
--
-- 100% aditiva (R11): nenhuma coluna some, nenhum registro é apagado.

-- 1) Garante que existe ao menos uma profissional para receber o backfill.
--    Mesmo nome que o `ensureProfessional()` usa, para não nascer uma segunda
--    "Milene". Só dispara em banco virgem — em produção nunca roda.
INSERT INTO "professionals" ("id", "name", "active")
SELECT gen_random_uuid(), 'Milene Ozorio', true
WHERE NOT EXISTS (SELECT 1 FROM "professionals");

-- 2) Guarda + backfill no MESMO bloco, para os dois usarem exatamente a mesma
--    profissional-alvo. Se a escolha divergisse entre a conferência e a
--    escrita, a conferência estaria validando um cenário que não é o que vai
--    acontecer.
DO $$
DECLARE
  alvo  uuid;
  pares integer;
  exemplo text;
BEGIN
  -- Prefere uma ativa; se todas estiverem inativas, usa a primeira mesmo assim.
  -- Não mexemos em `active`: reativar profissional é decisão da Mi, não de uma
  -- migration, e o backfill não precisa disso.
  SELECT "id" INTO alvo
    FROM "professionals"
   ORDER BY "active" DESC, "name", "id"
   LIMIT 1;

  -- Depois do backfill, TODA reserva viva hoje sem profissional passa a
  -- disputar a agenda de `alvo`. Colisão pode nascer de dois jeitos:
  --   NULL × NULL      → duas sem profissional que se sobrepõem;
  --   NULL × preenchida→ uma sem profissional sobre uma que já é da `alvo`.
  -- O segundo caso é o que me mordeu ao testar: sem ele, o UPDATE abaixo
  -- estoura a no_overlap com erro cru, no boot do container, e o deploy morre
  -- sem dizer o que houve. Os pares preenchida × preenchida não precisam ser
  -- checados: a constraint já os impede de existir.
  SELECT count(*), min(a."id"::text || ' x ' || b."id"::text)
    INTO pares, exemplo
    FROM "bookings" a
    JOIN "bookings" b
      ON a."id" < b."id"
     AND a."status" IN ('pending', 'confirmed')
     AND b."status" IN ('pending', 'confirmed')
     AND (a."professional_id" IS NULL OR b."professional_id" IS NULL)
     AND coalesce(a."professional_id", alvo) = coalesce(b."professional_id", alvo)
     AND tstzrange(a."starts_at", a."ends_at")
      && tstzrange(b."starts_at", b."ends_at");

  IF pares > 0 THEN
    RAISE EXCEPTION
      'Ha % par(es) de reservas vivas que passariam a colidir ao receber a profissional (ex.: %). '
      'Sao double-bookings que o professional_id NULL deixou passar. '
      'Cancele ou remarque uma de cada par em /admin e rode o deploy de novo.',
      pares, exemplo;
  END IF;

  -- Reservas encerradas (completed/cancelled/no_show) ficam fora do recorte da
  -- no_overlap, então entram sem risco; as vivas passaram pela checagem acima.
  UPDATE "bookings" SET "professional_id" = alvo WHERE "professional_id" IS NULL;
END $$;

-- 3) Fecha por estrutura. A partir daqui, TODA reserva tem profissional e a
--    no_overlap vale para todas elas — sem depender de o app lembrar.
ALTER TABLE "bookings"
  ALTER COLUMN "professional_id" SET NOT NULL;
