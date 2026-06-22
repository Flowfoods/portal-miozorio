# Automações n8n — Portal Mi Ozorio (M4)

Workflows que recebem eventos do app e enviam WhatsApp via **Evolution API**
(instância `evo-miozorio`). O app **não** fala direto com a Evolution: ele
`POST`a um evento no webhook do n8n (`src/lib/notify.ts → dispatchEvent`), e o
n8n decide a mensagem e envia.

> Telefones chegam em **E.164** (`+5521…`); o workflow normaliza removendo tudo
> que não é dígito. Copy marcada com `APROVAR COM A MI`.

---

## `mi-ozorio-whatsapp.workflow.json` — eventos → WhatsApp

Fluxo: **Webhook** → **Code (valida token + monta texto por `kind`)** →
**HTTP Request (Evolution `sendText`)**.

### Contratos que o app emite

| `kind` | Payload | Quando |
|--------|---------|--------|
| `club_points` | `{ kind, nome, telefone, pontos, motivo }` | Cliente ganha pontos no Clube (ex.: indicação concretizada) |
| `booking_confirmation` | `{ kind, nome, telefone, servico, inicio }` (`inicio` = ISO) | Mi cria encaixe manual com "Avisar no WhatsApp" |

> Obs.: o Clube migrou para PONTOS — o evento antigo `club_milestone` (escada) foi substituído por `club_points`.

### Como importar

1. n8n → **Workflows → Import from File** → selecione o `.json`.
2. **Credencial da Evolution (sem env do host):** o nó `Evolution · sendText` usa
   uma credencial **Header Auth** — crie em n8n → **Credentials → New → Header Auth**:
   - **Name** (do header): `apikey`
   - **Value**: a apikey da Evolution (pegue no Dokploy → compose `evo-miozorio`)
   - Salve como **"Evolution apikey"** e selecione-a no nó (substitui o placeholder
     `REPLACE_EVOLUTION_CRED_ID`).
   > A URL e a instância (`https://evo.miozorio.com.br` / `miozorio`) são **literais**
   > no nó (não são segredo). Só a apikey vai na credencial → **não precisa de variável
   > de ambiente nem mexer no compose do host** (R9 mantido: a key fica na credencial).
3. (`mi-ozorio-whatsapp` apenas) `MI_WEBHOOK_TOKEN` no Code Node — só se for usar o
   fluxo por **webhook**. ⚠️ Na arquitetura atual o **app fala direto com a Evolution**
   (`src/lib/notify.ts`); este workflow de webhook é **opcional/legado**.
4. **Ative** o workflow no n8n.

### Testar (mock)

```bash
curl -X POST "<PRODUCTION_WEBHOOK_URL>" \
  -H "Content-Type: application/json" \
  -H "x-webhook-token: <MI_WEBHOOK_TOKEN>" \
  -d '{"kind":"booking_confirmation","nome":"Ana","telefone":"+5521970225231","servico":"Maquiagem social","inicio":"2026-06-20T13:30:00.000Z"}'
```

A idempotência (não reenviar o mesmo evento) já é garantida **no app**
(`notification_log.dedup_key`, R10) — o n8n só envia o que recebe.

---

## `mi-ozorio-crons-clube.workflow.json` — fluxos por TEMPO

Estes não passam pelo app: um **Schedule Trigger** diário (09:00) consulta o
Postgres (`pg-miozorio`) e envia via o mesmo nó Evolution.

Fluxo: **Schedule (diário)** → **Postgres** (`SELECT` dos "devidos hoje", já
excluindo o que está em `notification_log`) → **Code** (monta texto por `kind`)
→ **Evolution `sendText`** → **Postgres** (grava `notification_log` = idempotência).

Cobre os 5 fluxos numa única query `UNION ALL`:

| `kind` | Quem | Regra |
|--------|------|-------|
| `lembrete_24h` | quem tem agendamento | `booking.status = confirmed` com `starts_at` **amanhã** (lembrete da véspera) |
| `aniversario` | membro do clube | `birth_date` (dia/mês) = hoje |
| `aniversario_cliente` | qualquer cliente | 1º `completed` faz exatamente 1 ano hoje |
| `pos_atendimento` | quem foi atendido | `completed` ontem (D+1; respeitar `photo_consent`, R18) |
| `reconexao` | membro do clube | último `completed` há > 12 meses |

> **`lembrete_24h`**: o cron roda 1×/dia (09:00), então é o lembrete da **véspera**
> (não 24h exatas). `dedup_key = lembrete_24h:<booking_id>` — não reenvia se rodar 2× no dia.
> Só dispara para agendamentos **confirmados** (pending/cancelled não entram).

Idempotência: `dedup_key` por (cliente, tipo, período) — ex.:
`aniversario:<id>:2026`, `reconexao:<id>:2026-06`. Rodar o cron de novo no mesmo
dia não reenvia.

### Textos editáveis pela Mi (sem mexer no n8n)
As mensagens **não são mais hardcoded** no Code node. A query `devidos hoje` traz a
coluna `template` via `LEFT JOIN site_content` na chave `msg.<kind>`, com
`COALESCE` para um default embutido no `CASE`. O nó **Montar mensagem** apenas
**interpola os placeholders** `{nome}` / `{servico}` / `{data}`.

➡️ A Mi edita os textos em **`/admin → Textos → grupo "Mensagens de WhatsApp"`**
(tabela `site_content`). O que ela salvar passa a valer no próximo envio, sem tocar
no workflow. ⚠️ Os defaults do `CASE` no SQL espelham `src/lib/content.ts`; se mudar
lá, atualize aqui também (ou apenas confie no override que a Mi salvar).

### Antes de ativar (precisa de validação)
- ⚠️ **Credencial Header Auth "Evolution apikey"** (header `apikey` = key da Evolution)
  selecionada no nó `Evolution · sendText` (substitui `REPLACE_EVOLUTION_CRED_ID`).
  **Sem env do host** — ver "Como importar".
- ⚠️ **Criar a credencial Postgres** no n8n apontando para `pg-miozorio` e
  substituir `REPLACE_PG_CRED_ID` nos 2 nós Postgres.
- ⚠️ **Revisar o SQL** contra o banco real (foi escrito a partir do schema, não
  testado em produção). As **mensagens** já saem prontas, mas a Mi pode ajustá-las
  no `/admin` (ver acima).
- Reconexão entra na query diária mas o `dedup_key` mensal evita repetição;
  ajuste a régua de tempo com a Mi se quiser.

### Combo recomendado de skills
`engine-data-sync-pro` (schema do banco) → `n8n-workflow-architect` (gerar os
crons) → `deploy-safeguard-hostinger` (subir) → `monitor-logistica-evolution`
(monitorar envios).
