# Auditoria WhatsApp / Evolution — FASE 0

> Somente leitura. Estado do envio/recebimento de WhatsApp no portal (08/07/2026).
> **100% dos envios são Evolution-direto** (`sendEvolutionText`) — o n8n saiu do
> caminho de envio (o cron n8n ficou inacessível e foi substituído pelo cron do
> portal, ver `reminders.ts`).

## 1. Inventário de fluxos (envio)

| # | Fluxo | Arquivo | Gatilho | Template | Status persistido |
|---|---|---|---|---|---|
| 1 | Confirmação de agendamento | `notify.ts` `dispatchEvent(booking_confirmation)` | evento (booking) | CMS `msg.booking_confirmation` | `NotificationLog` (dedup, **sem status**) |
| 2 | Lembrete 24h · aniversário · +1 ano cliente · pós-atendimento · reconexão | `reminders.ts` → `/api/cron/lembretes` | cron diário | CMS `msg.<kind>` | `NotificationLog` (dedup, **sem status**) |
| 3 | Pontos do Clube | `clube-pontos.ts` `dispatchEvent(club_points)` | evento (crédito) | CMS `msg.club_points` | `NotificationLog` |
| 4 | Momentos (pendente/aprovado/não publicado) | `momentos.ts` `dispatchEvent` | evento | CMS `msg.momento_*` | `NotificationLog` |
| 5 | Recuperação de senha (código 6 díg) | `cliente-recuperacao.ts` | ação da cliente | inline | `ClubPasswordReset` (código; **sem status de entrega**) |
| 6 | Jornadas (boas-vindas/manutenção/reativação) | `jornadas.ts` → fila | cron | CMS/inline | `EnvioMensagem` (aguardando→enviado/falha/cancelado) |
| 7 | Réguas/sugestões (recompra) | `reguas.ts` `gerarSugestoes` → fila | cron | — | `EnvioMensagem` |
| 8 | Envio manual (fila de aprovação) | `crm/mensagens/actions.ts` | Mi aprova/edita | texto editado | `EnvioMensagem` (status completo) |
| — | **Recebimento** (CONFIRMO/CANCELAR, ACK de entrega) | — | — | — | ❌ **inexistente** |

Modelos existentes: `NotificationLog` (dedup), `Jornada`/`JornadaEtapa`, `EnvioMensagem` (fila com status). **Não há** modelo `Campanha` — a Central de Campanhas (F2) é nova; a **fila de aprovação já existente é a base ideal** para o "modo aprovação manual".

## 2. Checklist de robustez (✅ / ⚠️ / ❌)

| Item | Estado | Nota |
|---|---|---|
| Serviço central único de envio | ⚠️ | `sendEvolutionText` é a única porta HTTP, mas os call sites estão espalhados (notify/reminders/jornadas/recuperação). Sem `WhatsAppService`/outbox. |
| Fila/outbox com retry persistente | ❌ | Só a fila `EnvioMensagem` tem status; **sem retry/backoff automático**. Lembretes e eventos são **fire-and-forget**. |
| Idempotência | ✅ | `dedupeKey`/`dedup_key` únicos em `NotificationLog` e `EnvioMensagem`. |
| Log de envio com status no admin | ⚠️ | Só a fila (`/admin/crm/mensagens`). `NotificationLog` **não tem status** (pendente/entregue/falha) nem tela consolidada. |
| Instância desconectada | ⚠️ | Env-gated no-op + best-effort. Falha de lembrete/evento **não vira FAILED reprocessável → perda silenciosa**. Fila marca "falha" mas **sem reprocesso**. |
| Telefone E.164 | ✅ | `phoneE164` no banco; `normalizeE164BR` na captura; envio faz `replace(/\D/)`. |
| Opt-out de marketing | ⚠️ | Existe `whatsappOptIn` (**opt-IN**, default `false`), respeitado por jornadas/fila. **Não há** `aceitaMarketing` (opt-out) nem tratamento de "SAIR/PARAR". |
| Throttling em lote | ❌ | Nenhum intervalo/teto entre mensagens. |
| Webhook Evolution→app com token | ❌ | **Nenhum receptor** (sem rota de entrada). ACK de entrega e resposta CONFIRMO/CANCELAR impossíveis hoje. |
| Segredos fora do código | ✅ | `EVOLUTION_API_URL/KEY/INSTANCE` em env. |

## 3. Workflows n8n: especificado × real

- **Real hoje:** n8n **fora do caminho de envio**. Todos os 8 fluxos enviam Evolution-direto (TLS) a partir do portal; agendamento por cron do Dokploy (`/api/cron/lembretes`, `/api/cron/rfv`).
- **Especificado em docs mas não operante:** cron de lembretes no n8n (substituído), webhooks de confirmação/reativação via n8n. Decisão a tomar na F1: manter Evolution-direto (mais simples, já funciona) e só **adicionar um receptor de webhook** para ACK/opt-out — sem reintroduzir n8n no envio.

## 4. Correções priorizadas

**P0 — crítico (fundação F1):**
- **Perda silenciosa:** sem outbox/retry, todo lembrete/evento que falha com a instância caída é **perdido** (não reprocessa). → outbox `whatsapp_message` com retry/backoff.
- **Sem opt-out real:** ligar campanhas em massa sem `aceitaMarketing` + "SAIR/PARAR" é risco **LGPD e de ban**. → campo opt-out + receptor de webhook.
- **Conteúdo (ação da Mi/Rodolfo, fora do código):** recompensa placeholder **"teste 1 — 10 pontos" está NO AR em `/clube`** → remover/substituir no admin.

**P1 — importante:**
- Sem **webhook receptor** → sem status "entregue" nem confirmação por resposta.
- Sem **throttling** → risco de ban ao disparar campanha.
- **Log fragmentado:** `NotificationLog` sem status; falta tela única de mensagens (F1 prevê `/admin/mensagens`).
- **Política de opt-in:** `whatsappOptIn` default `false` ⇒ a base atual **não recebe** relacionamento. Decidir: migrar base para `aceitaMarketing=true` (registrado) na F1.
- **Serviços sem preço (7):** escova, hidratação, reconstrução, cronograma capilar, brow lamination, design de sobrancelha, henna estão "Valor a combinar" → receita atribuída de campanha deve marcar **"—" (nunca R$0)**. Listados aqui para a Mi definir preços.

**P2 — melhoria:**
- Unificar os call sites em `WhatsAppService` (mudança mínima).
- Débito SEO canonical → `docs/DEBITOS.md` (fora de escopo).

## 5. Base a reaproveitar (não reinventar na F1/F2)
- **Fila de aprovação** (`EnvioMensagem` + `/admin/crm/mensagens`) = já é o "modo aprovação manual" da F2.
- **Segmentação** já existe: RFV (`rfv_segmento`), jornadas (boas-vindas/manutenção/reativação), réguas de recompra. A F2 deve **ler** isso, não duplicar.
- **Templates via CMS** (`content.ts`, chaves `msg.*`, `aplicarTemplate`) = base dos `campanha_template`.
- **Aniversário:** `customers.birth_date` (unificado, sem campo duplicado). ✅
- **Deep links por serviço** (`/agendar?servico=`) = base do `{link_agenda}`.
