# Financeiro — Automações (Fase 5)

> Nada aqui dispara sozinho até os **Dokploy Schedules** serem criados (gate do
> Rodolfo). O padrão do portal hoje é **cron via endpoint** (Authorization:
> Bearer `$CRON_SECRET`, fail-closed em `src/lib/security.ts`), disparado por
> Dokploy Schedules — os `n8n/` são legado. Todos idempotentes (R10).

## 1. Custos recorrentes (mensal, dia 1) — PRONTO

- **Endpoint:** `POST /api/cron/custos-recorrentes`
- **O que faz:** lê `recurring_costs` ativos e gera a `Expense` do mês corrente
  (competência = 1º do mês). Idempotente: não duplica se a despesa do template
  já existe no mês. Só grava no banco — não envia nada.
- **Schedule sugerido:** `0 6 1 * *` (03:00 SP do dia 1), tipo *application*:
  ```
  node -e 'fetch("https://miozorio.com.br/api/cron/custos-recorrentes",{method:"POST",headers:{Authorization:"Bearer "+process.env.CRON_SECRET}}).then(r=>r.text()).then(t=>console.log(t)).catch(e=>{console.error(String(e));process.exit(1)})'
  ```

## 2. Reconhecimento de receita de booking — PRONTO (sem cron)

- Acontece **na hora**: `markCompleted` (booking → `completed`) chama
  `reconhecerReceitaDeBooking` (idempotente por `bookingId`). Não precisa de cron.
- **Backfill** dos concluídos antigos sem lançamento: `backfillReceitaBookings()`
  (`src/lib/finance/queries.ts`). Rodar **uma vez** após o deploy (terminal do
  container ou um Schedule manual descartável). Seguro repetir.

## 3. Fechamento mensal + resumo no WhatsApp (dia 1) — SPEC (não implementado)

> Envia mensagem externa → deixado como spec para o seu “ok” (e para reusar o
> `resumoDoMes` + a Evolution já existente do portal).

- **Gatilho:** Schedule `30 6 1 * *` (03:30 SP do dia 1).
- **Passos:**
  1. `resumoDoMes(anoAnterior, mesAnterior, "caixa")` → DRE/KPIs do mês fechado.
  2. Montar texto curto (tom Mi): “Mês fechado 🗓️ Entrou {receita}, saiu
     {despesa}, resultado {lucro/prejuízo}. Ticket médio {x}.”
  3. Enviar pela Evolution ao WhatsApp da Mi (mesma lib de envio direto do portal).
  4. Idempotência: `notification_log.dedup_key = financeiro-fechamento-{ano}-{mes}`.
- **Por que não ativei:** é envio externo + decisão de copy/horário; o motor
  (`resumoDoMes`) já está pronto para plugar.

## Resumo dos Schedules a criar (quando autorizar)

| Cron (UTC) | Endpoint | Ação |
|---|---|---|
| `0 6 1 * *` | `/api/cron/custos-recorrentes` | gera despesas recorrentes do mês |
| (manual 1×) | `backfillReceitaBookings()` | reconhece receita de concluídos antigos |
| `30 6 1 * *` | (fechamento — a implementar) | resumo do mês no WhatsApp |
