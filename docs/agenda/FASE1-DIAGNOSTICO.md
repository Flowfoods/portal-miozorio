# Fase 1 — Diagnóstico da área de agendamento

> Análise de código, sem alteração. Base: `master` em 7019857.
> Todo achado abaixo foi confirmado lendo o código, com arquivo e linha.

## (a) Fluxo atual

### Cliente (site → `/agendar`)

```
AgendarWizard.tsx
  passo 1 serviço ──► GET /api/services  (where: active + bookableOnline)   ← R1 ok
  passo 2 data   ──► GET /api/availability
  passo 3 hora   ──┘
  passo 4 dados + anamnese (alergia/referência/ocasião) + consent LGPD
        │
        └─ POST /api/bookings ────────► createBooking()          booking-service.ts:84
              • valida bookableOnline (R1), telefone E.164, teto de pendentes
              • revalida o horário contra getAvailability()  ← fecha POST forjado
              • upsert Customer + ensureClubMember
              • cria Booking status=pending, holdExpiresAt = agora + hold_minutes (8)
              • BookingEvent(toStatus=pending, actor=customer)
              • ⛔ NÃO calcula depositCents   ⛔ NÃO notifica ninguém
        │
        └─ POST /api/bookings/:id/confirm ──► confirmBooking(id, actor="system")
              • needsDeposit = service.requiresDeposit || customer.requiresDeposit
              • if (needsDeposit && !depositPaidAt) → 402 requires_deposit  ⛔ BECO SEM SAÍDA
              • senão: status=confirmed, BookingEvent(actor=system)
        │
        └─ cron /api/cron/expirar-reservas (de hora em hora) ──► expireStaleHolds()
              • pending + holdExpiresAt vencido → status = cancelled_by_business
                                                   BookingEvent(actor=system,
                                                   reason="reserva_nao_concluida")
```

### Milene (`/admin` → Novo agendamento)

```
NovoAgendamento.tsx → createManualBooking()            booking-service.ts:301
  • nasce confirmed, sem hold, actor=admin
  • ignora lead time e expediente (ela decide); colisão continua soberana (R2)
  • aceita serviço não-agendável online (bloquear estúdio por noiva/debutante)
  • checkbox "horário livre (fora do padrão)" (linha 698) destrava o campo de hora;
    sem ele: "Marque 'horário livre' acima para encaixar" (linha 718)
```

### Máquina de estados

`BookingStatus` tem **6 valores** e **não existe `expired`**:
`pending · confirmed · completed · cancelled_by_client · cancelled_by_business · no_show`

| De | Para | Por | Onde |
|---|---|---|---|
| — | pending | cliente / Mi (encaixe) | `createBooking` / `createManualBooking` |
| pending | confirmed | sistema (cliente) ou business (Mi) | `confirmBooking:575` |
| pending | cancelled_by_business | **cron** | `expireStaleHolds:842` |
| pending/confirmed | no_show | Mi | `markNoShow:641` |
| confirmed | completed | Mi | `markCompleted:691` |
| pending/confirmed | cancelled_by_* | cliente ou Mi | `cancelBooking:758` |

Toda transição grava `BookingEvent` (R17). **Nenhuma transição sai de um estado
cancelado** — não há caminho de volta.

## (b) Causa-raiz de cada sintoma do caso Carla

O caso inteiro é explicado pela combinação de **duas ausências** e **uma
colisão de rótulo**. Nenhum dos sintomas é aleatório.

### 1. "Mostrou que precisa de sinal, mas não abriu o pagamento"
**Não existe pagamento no projeto.** Varredura por `mercadopago|pix|gateway|
checkout|payment` em `src/` não retorna nenhuma integração. `depositCents`
**nunca é escrito** em lugar nenhum do código; `depositPaidAt` só é *lido*
(`booking-service.ts:611,661,785`). O `claude.md` confirma: gateway PIX
(MP vs Efí) é pendência de negócio em aberto, do trilho futuro F7.

O que a Carla viu não era uma etapa de pagamento — era a **mensagem de erro**
do 402, renderizada como erro de formulário em `AgendarWizard.tsx:341`.

> **A "Exige sinal" é uma armadilha:** o checkbox existe no admin
> (`servicos/page.tsx:262`) e, no instante em que a Mi o liga, aquele serviço
> fica **impossível de agendar online** — `confirmBooking` passa a devolver 402
> para sempre, porque nada no sistema consegue preencher `depositPaidAt`.
> O seed não marca sobrancelha; a flag foi ligada à mão em produção.

### 2. "Milene não recebeu notificação"
**Não existe notificação para a Milene em lugar nenhum do sistema.** Os 8
`dispatchEvent` do código enviam todos para a *cliente*. O único ponto com o
número dela é `numeroMi()` (`campanhas/actions.ts:15`), usado só no disparo de
teste de campanha. `createBooking` termina no `return` sem chamar nada.

Não é uma falha de entrega da Evolution — a chamada nunca existiu.

### 3. "Apareceu como Cancelado (Mi)"
`expireStaleHolds:860` grava `status = "cancelled_by_business"` porque o enum
não tem `expired`. E `bookingStatus.ts:9` mapeia
`cancelled_by_business → "Cancelado (Mi)"`.

Metade disso já foi resolvido antes: `booking-historia.ts` lê o `BookingEvent`
e produz a frase **"O horário venceu sem a cliente concluir"** — que é
exatamente o que a Mi viu. O que ficou é a **pílula de status**, que continua
dizendo "Cancelado (Mi)" ao lado da frase que diz o contrário.

### 4. "Milene não conseguiu confirmar"
`confirmBooking:598` recusa com `not_pending` quando `status !== "pending"`.
Depois que o cron rodou, o status virou `cancelled_by_business` — e **não há
transição de volta**. Ela perdeu a janela.

Detalhe importante: o código **já previa** a Mi confirmar fora das regras —
`actor: "business"` pula a checagem de hold (`:605`) e a de sinal (`:609`).
O que falta não é permissão, é **estado alcançável**.

### 5. Carla sem saber se agendou
Consequência direta de 1+2: a reserva existia como `pending` invisível para
ambas, e expirou em **8 minutos** (`hold_minutes` = 8, `settings.ts:59`).

## (c) Os outros itens

| Item | Causa-raiz | Arquivo |
|---|---|---|
| **A1** Excluir só em alguns cards | `deletable = bookings+eventSessions+waitlist === 0`; a action recusa se houver histórico. Não existe soft delete — `Service` só tem `active` | `servicos/page.tsx:155,344` · `actions.ts:510` |
| **A6** 3× "Buço" | `adminCreateService` **não checa nome duplicado** — só `code` é unificado por sufixo. Form é server action sem estado de loading → duplo submit cria 2 | `actions.ts:458` |
| **A8** checkbox "horário livre" | Campo de hora só destrava com o checkbox marcado | `NovoAgendamento.tsx:698,718` |
| **A11** alerta de alergia | `temAlergia` acende com **qualquer** campo não-vazio, inclusive "Não" | `lib/anamnesis.ts:24` |

> **A11 não é um bug — é uma decisão sua, documentada.** `anamnesis.ts:3-5`:
> *"por decisão do Rodolfo, acende sempre que o campo estiver preenchido
> (literal ao master prompt), sem filtrar negações."* O prompt agora pede o
> inverso. Vou implementar como pedido, com a ressalva de segurança: alergia é
> dado de saúde e **falso-negativo é pior que falso-positivo**, então a
> normalização vai casar só negações exatas ("não", "nao", "n", "-", "nenhuma",
> "não tenho"), tratando qualquer outro texto como positivo.

## O que já existe e deve ser reaproveitado (não reconstruir)

- **Outbox de WhatsApp completo** (`WhatsAppMessage`): dedupeKey único, retry
  com backoff, status, painel em `/admin/mensagens`. A4 pede "retry + log" —
  **já está pronto**, só falta chamar.
- **`BookingItem`** com `priceTabelaCents`, `priceCobradoCents`, `motivoAjuste`
  — é quase exatamente o que A3 precisa para o ajuste de tamanho.
- **`Booking.photoKey` + `photoConsentAt`** — storage privado LGPD já existe;
  A3 (foto do cabelo) reusa em vez de criar.
- **`MediaAsset`** já tem `category: "servico"` — base de A2.
- **`historiaDoAgendamento`** — metade de A5 já está feita.
- **`evaluateCancel` / `evaluateNoShow`** (`policies.ts`) — a regra de
  reincidência (3 cancelamentos → sinal) **já existe e funciona**.

## Plano de execução da Fase 2

Ordem por dependência e por risco (o que destrava o caso Carla primeiro):

| # | Item | Arquivos | Migration |
|---|---|---|---|
| 1 | **A7-regra** desligar sinal por padrão + bloquear `pendingPrice`+`requiresDeposit` | `actions.ts`, `servicos/page.tsx`, `booking-service.ts` | dados |
| 2 | **A4** notificar a Mi em todo evento | `booking-service.ts`, novo `lib/notify-mi.ts`, `content.ts` | não |
| 3 | **A5** `cancelledBy` + reativar | `schema.prisma`, `booking-service.ts`, `bookingStatus.ts`, `admin/actions.ts` | aditiva |
| 4 | **A11** alergia | `lib/anamnesis.ts` | não |
| 5 | **A6** anti-duplicação + feedback | `actions.ts`, `servicos/page.tsx` (client) | limpeza |
| 6 | **A1** soft delete | `schema.prisma`, `actions.ts`, `servicos/page.tsx`, `api/services` | aditiva |
| 7 | **A8** horário livre sempre editável | `NovoAgendamento.tsx` | não |
| 8 | **A9** confirmação p/ cliente | `admin/actions.ts`, `content.ts` | não |
| 9 | **A10** pós-atendimento + pontos | `booking-service.ts`, `clube-pontos.ts`, `content.ts` | não |
| 10 | **A2** foto por serviço | `schema.prisma`, `media.ts`, `servicos/page.tsx`, wizard | aditiva |
| 11 | **A3** variação por tamanho | `schema.prisma` (modelo novo), motor, wizard, admin | aditiva |

## Bloqueios reais (precisam de decisão sua)

1. **A7-pagamento não é implementável aqui.** Não há gateway, não há
   credencial, e a escolha MP vs Efí é pendência de negócio no `claude.md`.
   A boa notícia: a **regra** de A7 (não exigir sinal por padrão) resolve o
   caso Carla sozinha, sem gateway nenhum.
2. **Migrations em produção são gate seu** (`claude.md`: "Gates — OK explícito
   do Rodolfo: mudança de schema em prod"). Escrevo e testo; aplicar é sua call.
3. **A6 limpeza de dados** precisa do banco de produção para saber quais são os
   duplicados reais. Escrevo o script idempotente com relatório; rodar é seu.
4. **Este ambiente não tem banco** (`DATABASE_URL` ausente). Consigo entregar a
   Fase 3.1 (testes automatizados, 246 hoje) — a **3.2/3.3 (checklist manual em
   staging) eu não consigo executar daqui**, só deixar o roteiro pronto.
