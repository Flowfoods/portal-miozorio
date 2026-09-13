# Fase 3 — Verificação e entrega

## O que este ambiente permite verificar

Este repositório foi trabalhado numa sessão **sem banco de dados** (`DATABASE_URL`
ausente — o mesmo cenário descrito no `claude.md` para o dev local do Rodolfo).

Consequência honesta: **3.1 foi executado; 3.2 e 3.3 não.** O roteiro está
pronto abaixo, mas nenhum item do checklist funcional recebe ✅ de mim, porque
marcar verde sem evidência é pior do que deixar em aberto.

| Gate | Status | Evidência |
|---|---|---|
| `npm test` | ✅ **360/360** (era 246) | saída do vitest |
| `tsc --noEmit` | ✅ limpo | exit 0 |
| `next lint` | ✅ sem avisos | exit 0 |
| `next build` | ✅ exit 0 | produção compila |
| `npm run test:db` | ✅ **18/18** contra Postgres 16 real | suíte de integração |
| Migrations aplicadas | ✅ as 6, num banco limpo | `prisma migrate deploy` |
| Checklist funcional (3.2) | ⬜ **não executado** | exige Evolution conectada |
| Caso Carla (3.3) | ⬜ **não executado** | idem |

> `prettier --check` acusa 13 arquivos — **já acusava no master antes desta
> frente** (verificado com `git stash`). O plugin do Tailwind quer reordenar as
> classes de arquivos inteiros; rodar `--write` produziria um diff enorme e sem
> relação. O pre-commit do repo roda lint+typecheck, não prettier.

## 3.1 — Testes automatizados: 114 novos

| Arquivo | Testes | Cobre |
|---|---|---|
| `tests/sinal.test.ts` | 8 | A7: quando há sinal, valor, prazo de 24h, corte de 2h, borda do lead time menor que o corte |
| `tests/notify-mi.test.ts` | 13 | A4: conteúdo da mensagem, link do admin, título por evento, multi-serviço |
| `tests/a5-reativar.test.ts` | 10 | A5: "Expirado (sistema)" × "Cancelado (Mi)", retrocompat com `null`, tom neutro, histórico |
| `tests/anamnesis.test.ts` | 29 | A11: 20 formas de "não", negação parcial que DEVE acender, tipos inesperados |
| `tests/servico-nome.test.ts` | 6 | A6: acento/caixa/espaço, serviços de verdade diferentes |
| `tests/notify-cliente.test.ts` | 5 | A9: endereço no estúdio, sem vazar no domicílio, placeholders |
| `tests/pos-atendimento.test.ts` | 9 | A10: saldo antes/ganho/agora, versão não-membro, voz da marca |
| `tests/variantes.test.ts` | 14 | A3: preço/duração por tamanho, aguardando-validação derivado |
| `tests/fase3-regras.test.ts` | 8 | R1 no backend, arquivado fora de circulação, tamanho/foto obrigatórios, LGPD |
| `tests/pagamento.test.ts` | 12 | A7: gateway ausente = nada muda; assinatura do webhook, incluindo `data.id` adulterado |

### Suíte de integração — o que era "não dá para testar" e passou a dar

Estes itens tinham ficado de fora por exigirem Postgres com a `EXCLUDE USING
gist` ativa. Um Postgres 16 local resolveu: agora são 18 testes em
`tests/integration/`, rodando com `npm run test:db` e no CI.

| Arquivo | Testes | Cobre |
|---|---|---|
| `no-overlap.itest.ts` | 8 | **R2**: sobreposição total e parcial recusada, `pending` segura o horário, encostar sem cruzar passa, cancelado/concluído liberam |
| `agenda-fluxos.itest.ts` | 10 | **A5**: reativação recusada com o slot ocupado, sem deixar o booking pela metade · **A3**: ajuste que estende a duração e colide · **A1**: arquivado some da listagem e o histórico fica |

**A R2 tinha ZERO cobertura automatizada** até aqui — é a regra mais crítica do
sistema e mora numa constraint, não no código. Dois testes também provam
empiricamente o **R21**: a constraint é parcial, e um status fora do recorte
(`completed`, usado como prova) realmente **não** é protegido.

O que segue exigindo ambiente com Evolution: duplo submit real pela interface e
o checklist funcional abaixo.

## 3.2 / 3.3 — Roteiro para rodar em staging

Pré-requisitos: banco com as 6 migrations novas aplicadas, Evolution conectada,
`WHATSAPP_MI` e `NEXT_PUBLIC_SITE_URL` no ambiente. O PIX (cenário 3b) só roda
com `PAGAMENTO_PROVIDER` + credenciais.

| # | Cenário | Esperado |
|---|---|---|
| 1 | Cliente agenda serviço sem sinal | Mi recebe WhatsApp na hora; status "Pendente" |
| 2 | Mi confirma no painel | Cliente recebe confirmação com local, valor e orientações; **uma** mensagem |
| 3 | Serviço com "Exige sinal", SEM gateway | Cliente vê "Seu horário está guardado", valor e prazo; botão só de WhatsApp; **nunca** um erro |
| 3b | Idem, COM gateway | Botão "Pagar sinal por PIX"; QR + copia-e-cola; ao pagar, a tela confirma sozinha |
| 4 | Não combina o sinal | Expira no prazo; rótulo **"Expirado (sistema)"**; Mi avisada; "Reativar e confirmar" funciona |
| 5 | Serviço com tamanho | Cliente escolhe + manda foto; Mi vê o bloco de validação; aprovar/ajustar; ajuste avisa a cliente |
| 6 | Cadastro de serviço | Toast "criado ✓"; botão trava em "Criando…"; nome duplicado bloqueado |
| 7 | Arquivar serviço com histórico | Some do admin, do dropdown, do `/agendar` e do `/dia-a-dia`; ficha da cliente intacta |
| 8 | Dropdown do encaixe | Agrupado por categoria; "Buço" uma vez só (**depois** de rodar o script de dedup) |
| 9 | Mi agenda fora do padrão | Sem checkbox; campo de hora sempre editável; aviso discreto; cria |
| 10 | Mi agenda em cima de outro | Bloqueado, com o nome de quem ocupa |
| 11 | Concluir atendimento | Pontos creditados **e** WhatsApp com saldo antes/ganhos/agora + Clube + Google |
| 12 | Card com "Alergia: Não" | Sem ⚠ |
| 13 | Foto do serviço | Aparece no menu visual; sem foto, monograma |
| 14 | Mobile 375px | Menu de serviços, upload e tela de sinal usáveis |
| 15 | Noiva/Debutante | Só CTA WhatsApp (o backend já está coberto por teste) |

**3.3 — Caso Carla:** Design de sobrancelha, domingo 11:30, pelo site.
Confirmar que (a) a Mi é notificada na hora, (b) não há exigência de sinal por
padrão, (c) havendo, a tela mostra "horário guardado" em vez de erro, (d) o
rótulo nunca diz "Cancelado (Mi)" para ação do sistema, (e) a Mi confirma ou
reativa em qualquer ponto.

## Rastreabilidade A1–A11

| Item | Commit | Teste que cobre | Status |
|---|---|---|---|
| A1 excluir/arquivar serviço | `c8bba03` | `fase3-regras` (arquivado fora) | ✅ código |
| A2 foto por serviço | `e3ec26a` | build + manual (13) | ✅ código |
| A3 variação por tamanho | `deab599` | `variantes`, `fase3-regras` | ✅ código |
| A4 notificar a Mi | `59f1123` | `notify-mi` | ✅ código |
| A5 reativar + rótulo | `172a78e` | `a5-reativar` | ✅ código |
| A6 anti-duplicação + feedback | `2791e1a` + `c8bba03` | `servico-nome` | ✅ código |
| A7 fluxo de sinal | `db21d8a` + `1474621` | `sinal`, `pagamento` | ✅ código |
| A8 horário livre | `4166c56` | manual (9, 10) | ✅ código |
| A9 confirmação p/ cliente | `2001904` | `notify-cliente` | ✅ código |
| A10 pós-atendimento + pontos | `b019136` | `pos-atendimento` | ✅ código |
| A11 alerta de alergia | `caea4be` | `anamnesis` | ✅ código |

### A7 — como a cobrança foi resolvida sem travar a decisão

O primeiro commit fechou a **regra** (sinal não é mais exigido por padrão), que
já resolve o caso Carla sozinha. O segundo fechou a **cobrança**.

A escolha MP × Efí continua sendo sua — o motor conversa com uma interface
(`src/lib/pagamento/tipos.ts`) e cada provedor é um adaptador. Trocar para Efí é
escrever `efi.ts` com a mesma interface e mudar uma env; o fluxo de agendamento,
que é o caminho que gera receita, não é tocado.

**Sem credencial configurada, nada muda.** `gatewayAtivo()` devolve null e o
portal se comporta exatamente como antes: reserva guardada, sinal combinado no
WhatsApp. A rota de cobrança devolve 501 e a tela nem mostra o botão — nenhuma
cliente vê um "Pagar" que não leva a lugar nenhum.

**Três camadas para o dinheiro não se perder:**
1. **Webhook** com assinatura HMAC verificada. Fail-closed: sem
   `MP_WEBHOOK_SECRET` recusa tudo. Um webhook de pagamento sem verificação
   seria um botão de "marcar como pago" aberto na internet — e trocar o
   `data.id` sem reassinar é recusado (tem teste).
2. **O webhook nunca é acreditado.** Ele só diz "algo mudou nesta cobrança"; se
   está paga, quem responde é o provedor, perguntado por nós.
3. **Cron de conciliação** (`/api/cron/conciliar-sinais`, a cada 10 min) varre
   cobranças em aberto. Webhook se perde — entrega falha, deploy no meio — e sem
   isso uma cliente que PAGOU ficaria "aguardando sinal" até o hold vencer, que
   é o pior desfecho possível porque o dinheiro entrou.

Idempotência em dois níveis: `X-Idempotency-Key` por booking no provedor (a
cliente recarregar a tela não abre um PIX novo) e `updateMany` condicional em
`registrarSinalPago` (webhook repetido não confirma nem notifica duas vezes).

## CI — o buraco que não existia antes

O repositório **não tinha CI nenhuma** (`.github/workflows/` não existia): os
testes, o typecheck e o build só rodavam se quem commitava lembrasse. O husky
cobre lint+typecheck no pre-commit local, mas um `--no-verify` ou um commit pela
interface do GitHub passava direto, e nada re-executava a suíte no PR.

`.github/workflows/ci.yml` roda em todo PR e push para `master`:

| Job | O que faz |
|---|---|
| `verificacao` | `npm ci` → `prisma generate` → lint → typecheck → **360 testes** → build de produção |
| `integracao` | sobe **postgres:16** (mesma versão de produção), aplica as **migrations de verdade** e roda os **18 testes de integração** |

O job de integração vale por si mesmo mesmo antes dos testes: **uma migration
com erro de SQL só aparecia no boot do container em produção.** Agora aparece no
PR.

## Migrations criadas (aplicar é gate do Rodolfo)

| Migration | O que faz | Risco |
|---|---|---|
| `20260913010000_a7_sinal_regra` | Desliga `requires_deposit` no catálogo; semeia prazos | Só dados; reversível por serviço |
| `20260913020000_a5_cancelled_by` | Coluna `cancelled_by` + backfill de `booking_events` | Aditiva |
| `20260913030000_a1_service_archived` | Coluna `archived_at` + índice parcial | Aditiva |
| `20260913040000_a2_foto_servico` | FK `media_asset_id` (ON DELETE SET NULL) | Aditiva |
| `20260913050000_a3_variacao_tamanho` | Tabela `service_variants` + 3 colunas em `bookings` | Aditiva |
| `20260913060000_a7_pagamento_sinal` | `deposit_provider` + `deposit_payment_id` + índices | Aditiva |

Todas aditivas (R11). Nenhuma apaga dado, nenhuma altera coluna existente.

**As 6 foram aplicadas num Postgres 16 limpo nesta sessão** — não são mais SQL
não executado. Verificado depois: a `no_overlap` continua parcial e intacta, o
enum `CancelledBy` existe com os 3 valores, `service_variants` nasceu com o
CHECK de valores válidos, e a migration do A7 semeou `deposit_percent=20`,
`deposit_hold_hours=24` e `deposit_cutoff_hours=2`.

## Passos manuais depois do deploy

1. **Rodar o dedup dos serviços** (os três "Buço"), em dry-run primeiro:
   ```
   DATABASE_URL="..." npx tsx scripts/dedup-servicos.ts            # só mostra
   DATABASE_URL="..." npx tsx scripts/dedup-servicos.ts --aplicar  # executa
   ```
   Ele elege o sobrevivente por mais histórico, re-aponta os agendamentos e
   **arquiva** os outros — nunca apaga.

2. **Conferir `WHATSAPP_MI`** no Dokploy. Sem ela o código usa o número da skill
   como fallback; com a Evolution desconectada, tudo vira no-op silencioso (as
   mensagens ficam `QUEUED` em `/admin/mensagens` e o cron drena depois).

3. **n8n/Evolution:** nada novo a configurar. As mensagens novas usam o outbox
   que já existe (`whatsapp_message` + cron `/api/cron/whatsapp-outbox`).

4. **Cron novo** no Dokploy Schedules, a cada 10 min (só faz sentido depois que
   o gateway estiver ligado; sem ele é no-op):
   ```
   curl -fsS -X POST https://miozorio.com.br/api/cron/conciliar-sinais \
     -H "Authorization: Bearer $CRON_SECRET"
   ```

5. **Se e quando ligar o pagamento** (ver `.env.example`): `PAGAMENTO_PROVIDER`,
   `MP_ACCESS_TOKEN` e `MP_WEBHOOK_SECRET` no Dokploy, e cadastrar o webhook
   `https://miozorio.com.br/api/webhooks/pagamento` (evento `payment`) no painel
   do Mercado Pago. Sem o secret, o webhook recusa tudo — é proposital.

## Pendente de decisão da Mi

- **Quais serviços exigem sinal.** A migration desligou todos; a flag continua
  no painel para ela religar onde quiser.
- **Prazo do sinal.** Hoje 24h com corte de 2h antes (`deposit_percent`,
  `deposit_hold_hours`, `deposit_cutoff_hours` em `business_settings`).
- **Percentual do sinal.** 20%, vindo da proposta social da skill.
- **Textos finais** das 4 mensagens novas (confirmação enriquecida, tamanho
  ajustado, pós-atendimento membro e não-membro) — todos editáveis em
  /admin > Textos.
- **Gateway de pagamento:** o adaptador do Mercado Pago está pronto e desligado.
  Se preferir Efí, é escrever `src/lib/pagamento/efi.ts` com a mesma interface —
  o fluxo de agendamento não muda.
