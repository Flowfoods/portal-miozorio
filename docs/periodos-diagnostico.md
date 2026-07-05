# Períodos — Diagnóstico (FASE 0)

> Inventário do estado ATUAL (master `b5d9e42`) de como cada tela/API do admin
> consome datas, as inconsistências encontradas e o plano de adoção do seletor
> de período global. Nenhuma mudança de comportamento nesta fase.

## 1. Inventário — telas do admin que dependem de data

| Tela | Como consome hoje | Granularidade | Timezone |
|---|---|---|---|
| `/admin` (Agenda) | `?data=YYYY-MM-DD&vista=semana` (searchParams, server component) | dia / semana sáb→sex | ✅ SP (`getSettings().timezone` via Luxon) |
| `/admin` (PainelHoje) | fixo: hoje + mês corrente | dia + mês | ✅ SP |
| `/admin/financeiro` (DRE) | `?mes=YYYY-MM&regime=caixa\|competencia` | mês | ✅ competência DATE em UTC-meia-noite; caixa em SP (`lib/finance/queries.ts`) |
| `/admin/financeiro/custos` | `?mes=YYYY-MM&cat=` (helper local `mesRange`) | mês | ⚠️ default do mês resolvido em **UTC** (bug de borda, ver §3) |
| `/admin/financeiro/receitas` | `?mes=YYYY-MM` (helper local duplicado) | mês | ⚠️ idem |
| `/admin/resumo` (Dashboard M14) | `?mes=YYYY-MM` → `getResumo` (`lib/stats.ts`; agregação pura `computeResumo`) | mês | ✅ SP |
| `/admin/crm` (hub) | **sem parâmetro** — janelas fixas no SQL cru (`INTERVAL '30 days'`, mês corrente p/ aniversariantes, recompra all-time) | fixa | ✅ `now()` do Postgres |
| `/admin/clube` | **sem período** — membros/saldos all-time; vouchers pendentes | all-time | n/a |
| `/admin/clientes` | `?q=` (busca); sem recorte temporal ("novas no período" não existe) | n/a | n/a |
| `/admin/clientes/[id]` (ficha) | histórico `take: 60`, sem período | n/a | ✅ exibição SP |

## 2. Inventário — APIs com data

| Rota | Parâmetro | Validação |
|---|---|---|
| `GET /api/availability` | `date=YYYY-MM-DD` (dia único) | ✅ Zod (`availabilityQuery`, `DATE_RE`) |
| `POST /api/bookings` | `date`+`time` | ✅ Zod |
| `/api/cron/*` | sem data (resolvem "agora" em SP no servidor) | n/a |

Não há hoje nenhuma rota de API de leitura por intervalo — as telas de admin
consultam o Prisma direto no server component. O contrato `de/até` da Fase 1
nasce para os searchParams das páginas e para futuras APIs.

## 3. Inconsistências encontradas

1. **Três formatos de parâmetro** convivendo: `data` (dia, Agenda), `mes`
   (mês, Financeiro/Resumo) e nenhum (CRM/Clube, janelas fixas). Sem padrão de
   intervalo arbitrário em lugar nenhum.
2. **Bug de borda de timezone em custos/receitas:** o `mesRange` local usa
   `DateTime.utc()` como fallback do mês corrente. Em 31/07 21h (SP) já é
   01/08 em UTC → a tela abre **no mês errado**. (A Agenda e o Resumo resolvem
   em SP, corretamente.)
3. **Helper duplicado:** `mesRange` copiado em `custos/page.tsx` e
   `receitas/page.tsx` — exatamente o antipadrão que a diretriz "uma única lib"
   proíbe.
4. **Duas convenções de fronteira de dia** (legítimas, mas hoje implícitas):
   colunas `DATE` (competência financeira) comparam em UTC-meia-noite; colunas
   `timestamptz` (bookings, ledger) comparam por instante SP→UTC. A lib nova
   precisa expor **as duas** para ninguém reimplementar.
5. **Índices por data:** `bookings(starts_at)` ✅ · `expenses/revenue_entries
   (competence_date)` ✅ · **`club_transactions(created_at)` ❌** (só
   customerId/status — necessário p/ extrato por período) · **`customers
   (created_at)` ❌** (necessário p/ "novas clientes no período").
6. CRM usa SQL cru com janelas fixas — o recorte de visualização por período
   entra **sem tocar na lógica RFV** (que é job diário e permanece).

## 4. Decisões de arquitetura (Fase 1)

- **Lib única:** `src/lib/periods.ts` — Luxon (padrão do projeto), funções
  puras com `now` injetável (testável), TZ `America/Sao_Paulo` (default vindo
  de `getSettings` na borda). Expõe o intervalo em **3 formas**: instantes
  (`from`/`to` p/ timestamptz), datas UTC-meia-noite (p/ colunas `DATE`) e
  ISO date-only (p/ URL).
- **URL como fonte de verdade:** `?periodo=hoje|ultimos7|ultimos30|mesAnterior`
  ou `?de=YYYY-MM-DD&ate=YYYY-MM-DD` (personalizado). Sem parâmetro → default
  do módulo (Agenda: hoje · Financeiro/Resumo: mês corrente — preserva
  comportamento atual).
- **Persistência do último preset por módulo:** cookie **httpOnly** gravado por
  server action (`mi_periodo_<modulo>`), lido no server component quando a URL
  não traz parâmetro. Escolhido em vez de tabela de preferências: zero
  migration, por-navegador é suficiente para preferência de UI.
- **Date range picker do "Personalizado":** inputs nativos `type=date`
  estilizados nos tokens da marca (PT-BR automático, mobile-first, acessível).
  Um calendário custom ficou como evolução — o nativo cumpre o aceite sem
  dependência nova.
- **Validação:** Zod no helper server-side único (`de ≤ até`, máx. 366 dias);
  personalizado inválido → mensagem gentil + fallback pro default do módulo.
- **Índices:** migration aditiva única com `club_transactions(created_at)` e
  `customers(created_at)` (Fase 4).

## 5. Plano de adoção módulo a módulo

| Fase | Módulo | O quê |
|---|---|---|
| 1 | — | `lib/periods.ts` + testes + `<PeriodSelector />` + contrato/validação + página de exemplo |
| 2 | Agenda | Seletor acima da agenda; `hoje` = visão atual intacta (dia/semana + ←→); períodos maiores = agrupamento por dia com contagens/receita/status |
| 3 | Financeiro + Resumo | `fetchMovimento` generalizado p/ intervalo; DRE/KPIs do período + comparação com período anterior equivalente; Resumo (dashboard) idem; corrige o bug UTC de custos/receitas usando a lib |
| 4 | CRM + Clube + Clientes | CRM: recorte temporal de visualização (novas clientes/atendimentos no período); Clube: extrato/indicações/resgates por período com totais; Clientes: filtro "novas no período"; migration dos 2 índices |
| 5 | — | Consistência visual, estados vazios, roteiro de regressão, deploy (gate) |

**Aceite da FASE 0:** ✅ inventário completo; ✅ nenhuma mudança de comportamento.
