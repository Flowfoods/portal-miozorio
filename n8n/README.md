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
2. Configure as **variáveis de ambiente** do n8n (não hardcode segredos — R9):
   - `EVOLUTION_API_URL` — ex.: `https://evo.suavps…`
   - `EVOLUTION_API_KEY` — apikey da Evolution
   - `EVOLUTION_INSTANCE` — `evo-miozorio`
   - `MI_WEBHOOK_TOKEN` — **mesmo valor** do `N8N_WEBHOOK_TOKEN` no Dokploy do app
     (o Code Node rejeita requisições sem o header `x-webhook-token` correto).
3. Abra o nó **Webhook**, copie a **Production URL** e cole no Dokploy do app em
   `N8N_WEBHOOK_URL`. Redeploy do app (sem isso o app não emite nada — no-op).
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

### Antes de ativar (precisa de validação)
- ⚠️ **Criar a credencial Postgres** no n8n apontando para `pg-miozorio` e
  substituir `REPLACE_PG_CRED_ID` nos 2 nós Postgres.
- ⚠️ **Revisar o SQL** contra o banco real (foi escrito a partir do schema, não
  testado em produção) e as **mensagens** (`APROVAR COM A MI`).
- Reconexão entra na query diária mas o `dedup_key` mensal evita repetição;
  ajuste a régua de tempo com a Mi se quiser.

### Combo recomendado de skills
`engine-data-sync-pro` (schema do banco) → `n8n-workflow-architect` (gerar os
crons) → `deploy-safeguard-hostinger` (subir) → `monitor-logistica-evolution`
(monitorar envios).
