# Runbook — subir a frente de agendamento

Passo a passo, em ordem. Cada passo diz **o que fazer**, **como saber que deu
certo** e **o que fazer se der errado**.

Nada aqui é irreversível até o passo 4. As 6 migrations são **aditivas**: criam
coluna e tabela, não apagam nem alteram nada existente.

---

## 0. Antes de tudo: um backup do banco

```bash
docker exec miozorio-pgmiozorio-p6ecqh \
  pg_dump -U postgres miozorio > backup-antes-agenda-$(date +%F).sql
```

**Deu certo se:** o arquivo tem tamanho > 0 (`ls -lh backup-antes-agenda-*.sql`).

Sem isto, não siga. É o único passo que não dá para refazer depois.

---

## 1. Merge e deploy

Branch: `bruce/adoring-faraday-vlk70j` → `master` → deploy pelo Dokploy.

O entrypoint roda `prisma migrate deploy` sozinho no boot — as 6 migrations
entram no momento em que o container sobe. Você não precisa rodar nada à mão.

**Deu certo se:** `https://miozorio.com.br/api/health` responde OK e mostra o
build novo.

**Se der errado:** o Dokploy mantém a versão anterior. Faça rollback pela
interface e me chame com o log do build.

---

## 2. Conferir que a agenda continua de pé

Abra `/admin` e veja um dia com atendimentos. Você deve ver:

- Os agendamentos de sempre, nos mesmos horários.
- Nenhum cartão dizendo "Cancelado (Mi)" para reserva que **venceu sozinha** —
  agora diz **"Expirado (sistema)"**.
- O alerta ⚠ de alergia **não** aparece mais em quem respondeu "Não".

**Se algo estiver errado aqui, pare** e me chame antes de seguir. Os passos
seguintes mexem em dados.

---

## 3. Conferir o WhatsApp

Confirme que `WHATSAPP_MI` está preenchida no Dokploy (é o número que vai
receber os avisos). Depois peça para alguém agendar um horário qualquer pelo
site.

**Deu certo se:** você recebe no WhatsApp uma mensagem "✨ Novo agendamento" com
o nome, o telefone, o serviço, o dia e um link direto para a ficha.

**Se não chegar:** abra `/admin/mensagens`. A mensagem vai estar lá com o status.
- `QUEUED` = está na fila, o cron manda em alguns minutos. Normal.
- `FAILED` = a Evolution recusou. O erro aparece na linha.
- **Não aparece nada** = a Evolution não está configurada. As mensagens só
  começam a sair quando ela estiver conectada; nada quebra enquanto isso.

---

## 4. Limpar os serviços duplicados (os três "Buço")

Primeiro **sem escrever nada**, só para ver o que ele faria:

```bash
DATABASE_URL="postgresql://..." npx tsx scripts/dedup-servicos.ts
```

Ele lista cada grupo duplicado, qual registro vai **manter** (o que tem mais
atendimentos) e quais vão ser arquivados.

**Leia a lista.** Se fizer sentido, rode de novo com `--aplicar`:

```bash
DATABASE_URL="postgresql://..." npx tsx scripts/dedup-servicos.ts --aplicar
```

**Deu certo se:** em `/admin/servicos` cada serviço aparece uma vez só, e no
"Novo agendamento" o dropdown também.

**Se der errado:** nenhum serviço é apagado — os duplicados ficam **arquivados**.
Para trazer um de volta:
```sql
UPDATE services SET archived_at = NULL, active = true WHERE code = '<code>';
```

---

## 5. Decidir o sinal

A migration **desligou "Exige sinal" em todos os serviços**. Isso foi
proposital: com a flag ligada e sem pagamento no portal, o serviço ficava
impossível de agendar — foi o que aconteceu com o Design de sobrancelha.

A regra automática continua valendo: **cliente com 3 cancelamentos só reagenda
pagando sinal**. Isso não depende da flag e não foi alterado.

Se você quiser sinal em algum serviço específico, ligue a caixinha
"Exige sinal" em `/admin/serviços`. Agora, quando ela está ligada, a cliente vê
"Seu horário está guardado" com o valor e o prazo — nunca mais um erro.

---

## 6. (Opcional) Ligar o pagamento por PIX

**Só faça isto quando decidir o provedor.** Enquanto estas três variáveis
estiverem vazias, o portal se comporta como hoje: reserva guardada e sinal
combinado no seu WhatsApp. Nenhuma cliente vê botão de pagar.

No Dokploy:
```
PAGAMENTO_PROVIDER = mercadopago
MP_ACCESS_TOKEN    = APP_USR-...      (credencial de PRODUÇÃO da conta da Mi)
MP_WEBHOOK_SECRET  = ...              (painel do MP → Webhooks → assinatura secreta)
```

No painel do Mercado Pago, cadastre o webhook:
```
https://miozorio.com.br/api/webhooks/pagamento      evento: payment
```

E agende no Dokploy Schedules, **a cada 10 minutos**:
```bash
curl -fsS -X POST https://miozorio.com.br/api/cron/conciliar-sinais \
  -H "Authorization: Bearer $CRON_SECRET"
```

> Esse cron é a rede de segurança: se um aviso do Mercado Pago se perder, ele
> encontra o pagamento mesmo assim. Sem ele, uma cliente que **pagou** poderia
> ficar esperando até o horário vencer.

**Deu certo se:** numa reserva com sinal aparece o botão "Pagar sinal por PIX",
o QR aparece, e ao pagar a tela confirma sozinha em alguns segundos.

**Se `MP_WEBHOOK_SECRET` ficar vazia:** o webhook recusa tudo, de propósito. Um
webhook de pagamento sem verificação seria uma porta aberta para qualquer um
marcar uma reserva como paga.

> Prefere Efí em vez de Mercado Pago? É escrever um arquivo novo
> (`src/lib/pagamento/efi.ts`) com a mesma interface. O agendamento não muda.

---

## 7. Cadastrar o que é novo (quando quiser)

Nada aqui é obrigatório — tudo tem um padrão que já funciona.

- **Foto por serviço** (`/admin/serviços` → "Foto de exemplo"): vira o cardápio
  visual do `/agendar`. Sem foto, aparece o monograma da marca.
- **Variação por tamanho** (mesma tela → "Variação por tamanho"): cadastre
  "cabelo curto", "cabelo longo" etc. com preço e, se quiser, duração própria.
  A partir daí a cliente escolhe o tamanho e **manda uma foto**, e você aprova
  ou ajusta antes de fechar o valor. Serviço sem variação continua igual.
- **Textos das mensagens** (`/admin` → Textos): as 4 mensagens novas
  (confirmação, tamanho ajustado, pós-atendimento para membro e para não-membro)
  são todas editáveis, com a lista de variáveis na ajuda de cada uma.

---

## Se precisar voltar atrás

| Situação | O que fazer |
|---|---|
| Deploy quebrou | Rollback pelo Dokploy (as migrations aditivas não atrapalham a versão antiga) |
| Serviço arquivado por engano | `UPDATE services SET archived_at = NULL, active = true WHERE code = '<code>';` |
| Quer o sinal de volta num serviço | Ligar "Exige sinal" em `/admin/serviços` |
| Quer desligar o PIX | Apagar `PAGAMENTO_PROVIDER` no Dokploy e redeploy |
| Quer o alerta de alergia acendendo sempre de novo | `src/lib/anamnesis.ts` — a lista `NEGACOES` controla isso |
