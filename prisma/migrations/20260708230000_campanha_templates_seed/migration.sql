-- F3 — biblioteca inicial de 8 templates no tom da Mi. Aditiva e idempotente
-- (só insere se a tabela estiver vazia; a Mi pode editar/apagar depois).
INSERT INTO "campanha_template" ("nome", "corpo")
SELECT * FROM (VALUES
  ('Sentimos sua falta',
   'Oi {nome} 💛 Faz {dias_sem_vir} dias que a gente não se vê! Que tal marcar um horário pra se cuidar? {link_agenda}'),
  ('Aniversário',
   'Feliz aniversário, {nome}! 🎉 Que seu dia seja lindo como você. Preparamos um mimo em pontos no Clube pra comemorar 💛'),
  ('Recompra de sobrancelha',
   'Oi {nome}! Seu design de sobrancelha já tem {dias_sem_vir} dias — hora de renovar pra manter o desenho perfeito 💛 {link_agenda}'),
  ('Cross-sell penteado',
   'Oi {nome} 💛 Você já conhece nossos penteados? Quem ama a make costuma se apaixonar. Vem viver essa experiência: {link_agenda}'),
  ('Pós-evento sazonal',
   'Oi {nome}! Época de festas chegando ✨ Já garantiu seu horário pra brilhar? A agenda enche rápido: {link_agenda}'),
  ('Campeãs VIP',
   '{nome}, você é uma das clientes mais especiais da casa 💛 Como agradecimento, você tem {pontos_clube} pontos no Clube pra usar quando quiser!'),
  ('Pontos expirando',
   'Oi {nome}! Você tem {pontos_clube} pontos no Clube Mi Ozorio esperando por você 💛 Que tal trocar por um mimo?'),
  ('Convite curso de automaquiagem',
   'Oi {nome} 💛 Abrimos novas vagas do curso de automaquiagem (R$280) — aprenda a realçar sua beleza todos os dias. Garanta a sua: {link_agenda}')
) AS t(nome, corpo)
WHERE NOT EXISTS (SELECT 1 FROM "campanha_template");
