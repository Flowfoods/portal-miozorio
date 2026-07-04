# Plano — Indicação com pontuação percentual · Clube Mi Ozorio

> Mapa de impacto para trocar o bônus de indicação de **valor fixo** para
> **percentual dos pontos que a indicada ganhou** no atendimento.
> Gerado por mapeamento read-only do código (master @ PR #73 / F6).

---

## Regra nova

Quando a **indicada** conclui um atendimento e pontua no Clube, a **indicadora**
ganha `floor(pontosDaIndicadaNoAtendimento × percentualIndicacao)`.

Ex.: percentual 20%, indicada ganha 150 pts → indicadora ganha 30 pts.

Config no admin (nada hardcoded):

| Config                | Descrição                                          | Default                |
| --------------------- | -------------------------------------------------- | ---------------------- |
| `percentualIndicacao` | % dos pontos repassados (0–100, decimal ex.: 12.5) | 20%                    |
| `escopoIndicacao`     | `PRIMEIRO_ATENDIMENTO` \| `TODOS_ATENDIMENTOS`     | `PRIMEIRO_ATENDIMENTO` |
| `programaAtivo`       | liga/desliga sem apagar vínculos                   | ativo                  |

Mudança de percentual vale só para eventos **futuros** — nunca recalcular passado.

---

## Estado atual (regra fixa) — onde tudo vive

| Peça                     | Local                                                               | Situação hoje                                                                                                      |
| ------------------------ | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Crédito de indicação     | `src/lib/clube-pontos.ts:101` `creditarPontosIndicacao(indicadaId)` | Credita **valor fixo** `clubPointsPerReferral` (default 100), `tipo:"referral"`, `dedupKey referral:${indicadaId}` |
| Gatilho                  | `src/lib/booking-service.ts:646`                                    | Chamado após `creditarPontosServico(id)` na conclusão. ✅ gatilho correto                                          |
| Pontos do serviço (base) | `src/lib/clube-pontos.ts:77` `creditarPontosServico`                | Credita `booking.service.clubPoints` à cliente **só se membro** (`clubJoinedAt`)                                   |
| Ledger                   | `prisma/schema.prisma:265` `model ClubTransaction`                  | `pontos`, `tipo` (String livre), `dedupKey @unique`. **Sem** colunas de snapshot                                   |
| Config                   | `src/lib/settings.ts:25` `clubPointsPerReferral`                    | key/value JSON em `business_settings`; leitura cacheada 60s                                                        |
| Notificação              | `src/lib/clube-pontos.ts:129` `dispatchEvent({kind:"club_points"})` | ✅ já existe, falha não-bloqueante (n8n)                                                                           |
| Vínculo / antifraude     | `src/app/(site)/clube/actions.ts:113` + `clube-pontos.ts:109`       | `referredById`; auto-indicação barrada por id                                                                      |

---

## Gaps a resolver (vs. prompt)

1. **Base de cálculo** = pontos da indicada _naquele booking_ = `booking.service.clubPoints`.
   ⚠️ **Decisão p/ Milene:** hoje a indicada só ganha pontos se for membro. Se não for,
   base = 0 → indicadora ganha 0. Confirmar se é o comportamento desejado.
2. **Idempotência muda de chave** — hoje `referral:${indicadaId}` (1x por indicada, de
   facto já é `PRIMEIRO_ATENDIMENTO`). Prompt pede `bookingId + motivo`.
   Nova dedup: `referral_pct:${bookingId}`. Escopo `PRIMEIRO_ATENDIMENTO` passa a exigir
   check extra: não existir crédito percentual anterior para aquela indicada.
3. **Snapshot no ledger** — `ClubTransaction` não tem colunas p/ percentual/base/bookingId/
   indicadaId. Migration: adicionar colunas nullable (ou campo JSON `meta`).
   Novo `tipo:"referral_percent"` (motivo `INDICACAO_PERCENTUAL`); manter `"referral"`
   como legado de leitura.
4. **Config nova** em `settings.ts` (`BusinessSettings` + `DEFAULTS` + parser em `getSettings`)
   e migration seed: `percentualIndicacao`, `escopoIndicacao`, `programaAtivo`.
5. **⚠️ Estorno (item 6) não tem base hoje** — `cancelBooking` (`booking-service.ts:677`)
   só atua **antes** da conclusão; nenhum fluxo reverte pontos de atendimento já concluído.
   O "lançamento espelhado negativo" exige um caminho de reversão que **ainda não existe**.
   Escopo extra real → alinhar se entra agora ou vira fase 2.
6. **Arredondamento** `floor`, mínimo 1 se `0 < x < 1`. Função pura nova, testável.
7. **Migração da regra antiga:** créditos `"referral"` fixos ficam intocados; indicadas já
   vinculadas sem atendimento concluído seguem a regra nova; se `PRIMEIRO_ATENDIMENTO`,
   indicada que já teve bônus fixo pago **não** gera novo bônus.

---

## Entrega sugerida (rodar em `portal-miozorio`, skills do prompt)

1. **Migration Prisma** — colunas de snapshot em `club_transactions` + 3 settings + dedup por booking.
2. **Refactor** `creditarPontosIndicacao` → percentual + escopo + snapshot + `floor`
   (base = `booking.service.clubPoints` da indicada; assinatura provavelmente muda para
   receber `bookingId`, hoje recebe só `indicadaId`).
3. **Testes unitários** — cálculo, arredondamento, idempotência, estorno, escopo, auto-indicação
   (`sec-audit-fraud-guard`).
4. **UI admin** — percentual (validação 0–100), seletor de escopo, preview ao vivo
   ("indicada ganha 150 → indicadora ganha 30").
5. **Área da Cliente** — card "Indique e ganhe" e extrato com percentual dinâmico
   (`{percentual}%` vindo da config).
6. **n8n** — reusar `dispatchEvent({kind:"club_points"})`; documentar workflow (`n8n-workflow-architect`).
7. **Deploy** — `deploy-safeguard-hostinger` (lint + build + migrations + Dokploy + health check + rollback).

---

## Critérios de aceite (do prompt)

- [ ] Percentual e escopo configuráveis no admin, com validação e preview.
- [ ] Atendimento concluído da indicada → indicadora recebe `floor(pontosDaIndicada × %)` no mesmo instante.
- [ ] Snapshot completo no ledger (percentual, base, bookingId, indicada).
- [ ] Idempotência (reprocessar o mesmo evento não duplica).
- [ ] Estorno reverte o bônus com lançamento espelhado.
- [ ] Escopos `PRIMEIRO_ATENDIMENTO` e `TODOS_ATENDIMENTOS` funcionando.
- [ ] Créditos históricos da regra fixa preservados intocados.
- [ ] Autoindicação bloqueada.
- [ ] Card e extrato refletindo a regra nova com percentual dinâmico.
- [ ] WhatsApp de bônus via n8n, com falha não-bloqueante.
