# Fase 3 — Verificação e entrega

## O que este ambiente permite verificar

Este repositório foi trabalhado numa sessão **sem banco de dados** (`DATABASE_URL`
ausente — o mesmo cenário descrito no `claude.md` para o dev local do Rodolfo).

Consequência honesta: **3.1 foi executado; 3.2 e 3.3 não.** O roteiro está
pronto abaixo, mas nenhum item do checklist funcional recebe ✅ de mim, porque
marcar verde sem evidência é pior do que deixar em aberto.

| Gate | Status | Evidência |
|---|---|---|
| `npm test` | ✅ **348/348** (era 246) | saída do vitest |
| `tsc --noEmit` | ✅ limpo | exit 0 |
| `next lint` | ✅ sem avisos | exit 0 |
| `next build` | ✅ exit 0 | produção compila |
| Checklist funcional (3.2) | ⬜ **não executado** | exige banco + Evolution |
| Caso Carla (3.3) | ⬜ **não executado** | idem |

> `prettier --check` acusa 13 arquivos — **já acusava no master antes desta
> frente** (verificado com `git stash`). O plugin do Tailwind quer reordenar as
> classes de arquivos inteiros; rodar `--write` produziria um diff enorme e sem
> relação. O pre-commit do repo roda lint+typecheck, não prettier.

## 3.1 — Testes automatizados: 102 novos

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

### Itens de 3.1 que exigem banco e ficaram fora

Estes precisam de Postgres com a `EXCLUDE USING gist` ativa — mockar o Prisma
testaria o mock, não a trava, e daria uma falsa sensação de cobertura:

- `expirado → confirmado` via reativação **com o slot já ocupado** (a garantia é
  a constraint, não o código).
- Ajuste de tamanho que estende a duração e colide com o próximo atendimento.
- Duplo submit real gerando um único registro de serviço.
- Soft delete escondendo da listagem e preservando agendamentos.

## 3.2 / 3.3 — Roteiro para rodar em staging

Pré-requisitos: banco com as 5 migrations novas aplicadas, Evolution conectada,
`WHATSAPP_MI` e `NEXT_PUBLIC_SITE_URL` no ambiente.

| # | Cenário | Esperado |
|---|---|---|
| 1 | Cliente agenda serviço sem sinal | Mi recebe WhatsApp na hora; status "Pendente" |
| 2 | Mi confirma no painel | Cliente recebe confirmação com local, valor e orientações; **uma** mensagem |
| 3 | Serviço com "Exige sinal" ligado | Cliente vê "Seu horário está guardado", valor do sinal e prazo; **nunca** um erro |
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
| A7 fluxo de sinal | `db21d8a` | `sinal` | ⚠️ **parcial — ver abaixo** |
| A8 horário livre | `4166c56` | manual (9, 10) | ✅ código |
| A9 confirmação p/ cliente | `2001904` | `notify-cliente` | ✅ código |
| A10 pós-atendimento + pontos | `b019136` | `pos-atendimento` | ✅ código |
| A11 alerta de alergia | `caea4be` | `anamnesis` | ✅ código |

### A7 é o único parcial, e é importante entender por quê

**Não existe gateway de pagamento no projeto.** `depositCents` nunca era escrito
por nenhum caminho do código, e a escolha MP × Efí é pendência de negócio
registrada no próprio `claude.md`. Então a parte de A7 que pedia "levar a cliente
para a tela de pagamento" **não foi implementada** — não há para onde levar.

O que foi feito resolve o caso Carla inteiro sem gateway: o sinal deixou de ser
exigido por padrão (a política `deposit_policy` do banco já dizia isso desde o
seed), e quando há sinal a reserva nasce com prazo real e a cliente vai para o
WhatsApp da Mi — que é onde o PIX acontece de verdade hoje.

## Migrations criadas (aplicar é gate do Rodolfo)

| Migration | O que faz | Risco |
|---|---|---|
| `20260913010000_a7_sinal_regra` | Desliga `requires_deposit` no catálogo; semeia prazos | Só dados; reversível por serviço |
| `20260913020000_a5_cancelled_by` | Coluna `cancelled_by` + backfill de `booking_events` | Aditiva |
| `20260913030000_a1_service_archived` | Coluna `archived_at` + índice parcial | Aditiva |
| `20260913040000_a2_foto_servico` | FK `media_asset_id` (ON DELETE SET NULL) | Aditiva |
| `20260913050000_a3_variacao_tamanho` | Tabela `service_variants` + 3 colunas em `bookings` | Aditiva |

Todas aditivas (R11). Nenhuma apaga dado, nenhuma altera coluna existente.

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

## Pendente de decisão da Mi

- **Quais serviços exigem sinal.** A migration desligou todos; a flag continua
  no painel para ela religar onde quiser.
- **Prazo do sinal.** Hoje 24h com corte de 2h antes (`deposit_percent`,
  `deposit_hold_hours`, `deposit_cutoff_hours` em `business_settings`).
- **Percentual do sinal.** 20%, vindo da proposta social da skill.
- **Textos finais** das 4 mensagens novas (confirmação enriquecida, tamanho
  ajustado, pós-atendimento membro e não-membro) — todos editáveis em
  /admin > Textos.
- **Gateway de pagamento** (MP × Efí), se e quando quiser cobrança no portal.
