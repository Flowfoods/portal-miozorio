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
| `club_milestone` | `{ kind, nome, telefone, nivel, beneficio }` | Indicada realiza atendimento e a embaixadora bate um degrau da escada |
| `booking_confirmation` | `{ kind, nome, telefone, servico, inicio }` (`inicio` = ISO) | Mi cria encaixe manual com "Avisar no WhatsApp" |

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

## Fluxos por TEMPO — ainda a construir (cron no n8n)

Estes não passam pelo app: são **Schedule Triggers** no n8n consultando o
Postgres (`pg-miozorio`) e enviando via o mesmo nó Evolution. Descritos aqui
como especificação; implementar depois (precisam de credencial Postgres no n8n).

| Fluxo | Cron | Query (alto nível) | Mensagem |
|-------|------|--------------------|----------|
| **Aniversário** | diário 09:00 | `customers` com `birth_date` (dia/mês = hoje) e `club_joined_at` not null | Parabéns + convite/mimo (APROVAR COM A MI) |
| **+1 ano de cliente** | diário | 1º `booking` `completed` faz exatamente 12 meses | "Faz 1 ano que a gente se conheceu…" |
| **Pós-atendimento D+1** | diário | `booking` `completed` ontem | Agradecimento + pedido de avaliação/foto (respeitar `photo_consent`, R18) |
| **Reconexão >12m** | semanal | membros do clube cujo último `completed` foi há > 12 meses (`segmentoDe` = EM_RECONEXAO) | "Saudades! Que tal remarcar?" |

> Para idempotência destes, gravar em `notification_log` com `dedup_key` por
> (cliente, tipo, período) — ex.: `aniversario:<customerId>:2026`.

### Combo recomendado de skills
`engine-data-sync-pro` (schema do banco) → `n8n-workflow-architect` (gerar os
crons) → `deploy-safeguard-hostinger` (subir) → `monitor-logistica-evolution`
(monitorar envios).
