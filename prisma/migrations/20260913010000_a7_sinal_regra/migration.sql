-- A7 — o sinal deixa de ser exigido por serviço; fica só a reincidência.
--
-- Por que: o portal não tem gateway de pagamento. `deposit_paid_at` nunca é
-- preenchido por nenhum caminho do código, então todo serviço com
-- `requires_deposit = true` ficava IMPOSSÍVEL de agendar online — a cliente
-- reservava, tomava 402 na confirmação e o hold de 8 min matava a reserva.
-- Foi exatamente o que aconteceu com "Design de sobrancelha".
--
-- A regra do negócio (business_settings.deposit_policy, que já estava no banco
-- desde o seed) sempre foi `{"default":"none","on_strikes":true}`: sinal só na
-- reincidência. Essa via continua intacta — ela mora em `customers.requires_deposit`
-- e é escrita por policies.ts a partir dos strikes. Esta migration só alinha o
-- catálogo à política que já estava escrita.
--
-- Aditiva e reversível: não altera schema, só dados de uma coluna booleana.
-- A Mi continua podendo religar a flag serviço a serviço no /admin — e agora,
-- quando ela liga, a reserva nasce "aguardando sinal" com prazo de verdade em
-- vez de virar um beco sem saída.
--
-- Para reverter um serviço específico:
--   UPDATE services SET requires_deposit = true WHERE code = '<code>';

UPDATE services SET requires_deposit = false WHERE requires_deposit = true;

-- Prazos do sinal (R3 — zero hardcode). Só insere se ainda não existir, para
-- não sobrescrever ajuste que a Mi já tenha feito.
-- "updatedAt" é NOT NULL sem default (Prisma preenche no client, mas SQL cru não).
INSERT INTO business_settings ("key", "value", "updatedAt")
VALUES
  ('deposit_percent', '20'::jsonb, now()),
  ('deposit_hold_hours', '24'::jsonb, now()),
  ('deposit_cutoff_hours', '2'::jsonb, now())
ON CONFLICT ("key") DO NOTHING;
