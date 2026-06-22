# Runbook — Ativação do n8n (automações por tempo) · Portal Mi Ozorio

> **Objetivo:** ligar as mensagens automáticas **por tempo** (lembrete da véspera,
> aniversário, +1 ano, pós-atendimento, reconexão).
>
> **Tempo estimado:** ~20 min. **Pré-requisito:** WhatsApp da Mi conectado
> (instância `miozorio` em **"open" 🟢** no Manager — ver `RUNBOOK-evolution-whatsapp.md`).

---

## ⚠️ Leia primeiro — o que o n8n faz (e o que NÃO faz mais)

O app já manda **direto** pela Evolution (sem n8n) as mensagens **disparadas por evento**:
- 🎉 **Parabéns de pontos do Clube** (quando a cliente ganha pontos)
- ✅ **Confirmação de encaixe** (quando a Mi cria agendamento com "Avisar no WhatsApp")

Isso vive em `src/lib/notify.ts` e depende das envs `EVOLUTION_*` no **portal** (já setadas).

➡️ **Portanto, o n8n agora serve SÓ para os fluxos POR TEMPO**, que rodam 1×/dia
consultando o banco. **Você só precisa ativar 1 workflow:**
**`n8n/mi-ozorio-crons-clube.workflow.json`**.

> O outro arquivo (`mi-ozorio-whatsapp.workflow.json`, baseado em webhook) é
> **redundante** com a arquitetura atual (app→Evolution direto). Só importe/ative
> se um dia quiser voltar a rotear eventos via n8n. **Para a operação normal, ignore-o.**

### Os 5 fluxos por tempo (workflow dos crons)
| `kind` | Quando dispara |
|--------|----------------|
| `lembrete_24h` | agendamento **confirmado para amanhã** (lembrete da véspera) |
| `aniversario` | membro do clube faz aniversário hoje |
| `aniversario_cliente` | 1º atendimento concluído faz exatamente 1 ano hoje |
| `pos_atendimento` | atendimento concluído **ontem** (D+1) — pede avaliação/foto |
| `reconexao` | membro do clube sem atendimento há > 12 meses |

Idempotência (R10): cada envio grava `notification_log.dedup_key` — rodar o cron 2×
no mesmo dia **não** reenvia.

---

## Passo 1 — Abrir o n8n
- O n8n roda na VPS (container `n8n_n8n`). Acesse a URL do n8n no navegador e faça login.
- (Se não souber a URL, ela está no Dokploy → projeto do n8n → Domains.)

## Passo 2 — Importar o workflow dos crons
1. n8n → **Workflows** → **Import from File**.
2. Selecione **`n8n/mi-ozorio-crons-clube.workflow.json`** (do repo).
3. O workflow abre com 5 nós: *Todo dia 09:00 → Postgres (devidos hoje) → Montar
   mensagem → Evolution sendText → Postgres (registrar envio)*.

## Passo 3 — Credencial da Evolution (Header Auth — SEM env do host)
> O n8n roda **fora** do Dokploy (container avulso), então **não** dependemos de
> variável de ambiente. A apikey vai numa **credencial do próprio n8n**; a URL e a
> instância já são literais no nó (`https://evo.miozorio.com.br` / `miozorio`).

1. n8n → **Credentials → New → Header Auth**.
2. **Name** (do header): `apikey`
3. **Value**: a apikey da Evolution — pegue no **Dokploy → compose `evo-miozorio`
   → Environment → `AUTHENTICATION_API_KEY`** (não cole aqui no doc).
4. Salve como **"Evolution apikey"**.
5. No nó **`Evolution · sendText`**, selecione essa credencial (substitui o
   placeholder `REPLACE_EVOLUTION_CRED_ID`).

## Passo 4 — Criar a credencial Postgres (aponta para o banco do portal)
1. n8n → **Credentials** → **New** → **Postgres**.
2. Preencha (banco **`pg-miozorio`**, o do portal — é onde estão `customers`,
   `bookings`, `services`, `notification_log`):
   - **Host:** `miozorio-pgmiozorio-p6ecqh` (host interno do Docker na VPS)
   - **Port:** `5432`
   - **Database:** `miozorio`
   - **User:** `miozorio`
   - **Password:** *(pegar no Dokploy → app **portal-miozorio** → Environment →
     dentro de `DATABASE_URL`, a parte entre `miozorio:` e `@`)*
   - **SSL:** desabilitado (rede interna)
3. Salve (teste a conexão).
4. Nos **2 nós Postgres** do workflow ("devidos hoje" e "registrar envio"),
   selecione essa credencial (eles vêm com o placeholder `REPLACE_PG_CRED_ID`).

## Passo 5 — Validar o SQL e as mensagens com a Mi ⚠️
1. Abra o nó **Postgres · devidos hoje** → **Execute node** (execução manual, não envia
   nada ainda) → confira se as colunas voltam certas e se os "devidos de hoje" fazem sentido.
   - O SQL foi escrito a partir do schema; rode uma vez e confira contra o banco real.
2. **Textos:** as mensagens são editáveis pela Mi em **`/admin → Textos → grupo
   "Mensagens de WhatsApp"`** (não precisa mexer no n8n). O nó **Montar mensagem** só
   interpola os placeholders `{nome}` / `{servico}` / `{data}`. Revise/aprovem a copy
   por lá antes de ativar.

## Passo 6 — Teste de ponta (1 envio controlado)
- A forma mais segura: garanta que exista **1 caso real devido hoje** (ex.: um agendamento
  `confirmed` para amanhã, para testar `lembrete_24h`), rode o workflow manualmente
  (**Execute workflow**) e confirme que **a mensagem chega** e que a linha foi gravada em
  `notification_log` (rodar de novo não deve reenviar).

## Passo 7 — Ativar
- Com tudo validado, ligue o toggle **Active** do workflow. Ele passa a rodar todo dia
  às **09:00** (TZ do n8n).

---

## Checklist de aceite
- [ ] Workflow dos crons importado
- [ ] Credencial **Header Auth "Evolution apikey"** criada e ligada no nó `Evolution · sendText`
- [ ] Credencial Postgres criada e ligada nos 2 nós
- [ ] `Execute node` do SQL retorna dados coerentes
- [ ] Mensagens revisadas/aprovadas com a Mi
- [ ] 1 envio de teste chegou no WhatsApp + gravou em `notification_log`
- [ ] Workflow **Active**

## Notas
- Cron roda 1×/dia → `lembrete_24h` é o lembrete da **véspera**, não 24h exatas
  (suficiente na prática; ajustável com a Mi).
- Eventos imediatos (parabéns de pontos, confirmação de encaixe) **não passam pelo n8n** —
  já saem do app direto. Se quiser centralizar tudo no n8n no futuro, importe também o
  `mi-ozorio-whatsapp.workflow.json` e configure `N8N_WEBHOOK_URL`/`N8N_WEBHOOK_TOKEN` no
  portal (hoje vazios = app usa o modo direto).
- Fuso de tudo: `America/Sao_Paulo`.
