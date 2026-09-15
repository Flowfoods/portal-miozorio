# QA ponta a ponta — posse da reserva e teto por IP (14/09/2026)

A dívida da posse (`docs/DEBITOS.md`) dizia, desde 15/08: *"a correção mexe no
caminho que gera receita — fazer junto com um QA logado de ponta a ponta"*. Este
documento é esse QA, e o que ele encontrou.

## O que permitiu executar

Diferente das frentes anteriores (e do `claude.md`, que descreve o dev local sem
banco), esta sessão **tinha** como subir um PostgreSQL 16 de verdade. O portal
rodou contra ele, num Chromium real, em viewport de 390px (R19).

Nenhuma mensagem saiu para ninguém: sem `EVOLUTION_API_URL`/`_KEY`/`_INSTANCE` e
sem `N8N_WEBHOOK_URL`, `sendText` lança antes de qualquer request e as
notificações são best-effort. **Nada foi tocado em produção.**

| Gate | Status |
|---|---|
| `npm test` | ✅ 526/526 |
| `npm run test:db` | ✅ **21/21** contra Postgres 16 real |
| Migrations do zero | ✅ as **43**, banco limpo (`prisma migrate deploy`) |
| `tsc --noEmit` · `next lint` · `next build` | ✅ limpos |
| QA funcional no browser | ✅ **26 asserções**, detalhadas abaixo |

## A) A cliente marca e confirma pela tela

O risco que a dívida nomeava: quebrar o caminho que gera receita. Fluxo completo
do wizard (serviço → data → horário → dados → confirmar), em 390px.

- ✅ o comprovante é emitido na criação (1 cookie)
- ✅ `httpOnly` — nenhum script lê
- ✅ `path=/` — vale no site inteiro
- ✅ `SameSite=Lax` — link do WhatsApp/Instagram não derruba
- ✅ não carrega o id da reserva nem PII: só prazo e assinatura
- ✅ **tela "Agendamento confirmado" apareceu**
- ✅ o comprovante é limpo depois de confirmar

## B) O buraco que a dívida descrevia

- ✅ navegador limpo, **com o id na mão**, recebe **403 `sem_posse`**
- ✅ a reserva **continua `pending`** — ninguém confirmou nada
- ✅ a dona, no mesmo navegador, confirma normal (**200**)

O terceiro item é o que separa "fechei o buraco" de "quebrei a rota".

> **15/09/2026 — o roteiro mudou e foi executado de novo.** A posse passou a
> valer também nos dois GETs (`/sinal` e `/api/bookings/[id]`, ver
> `DEBITOS.md`). O estranho deixou de conseguir ler o status — e isso virou
> asserção: ✅ **estranho nem lê o status (403)**. A leitura de "continua
> `pending`" passou para o navegador da dona. Registro completo abaixo.

## Execução de 15/09/2026 — posse nos GETs e o cenário F

Mesma natureza da execução de 14/09: **PostgreSQL 16.13 local**, subido do
zero nesta sessão (`initdb` + as **43 migrations** por `prisma migrate
deploy`), Chromium real (revisão 1194, via `CHROME=`), viewport 390px (R19).
Portal em `next start` contra um banco só do e2e. Sem gateway (R22), sem
Evolution/n8n — nada saiu para ninguém, nada tocou produção.

| Gate | Status |
|---|---|
| `npm test` | ✅ 543/543 (+17 de `tests/posse-sinal.test.ts`) |
| `npm run test:db` | ✅ **21/21** contra Postgres 16 real, num segundo banco |
| Migrations do zero | ✅ as **43**, nos dois bancos |
| `scripts/qa-agendar.mjs` | ✅ **34 asserções** (eram 26), **duas execuções** — a segunda a partir do estado zerado pelo SQL do cabeçalho, para provar que o roteiro é repetível |
| `next.log` durante o QA | ✅ 6 linhas, nenhum erro |

Os cenários A–E rodaram idênticos aos de 14/09, com a asserção nova no B. O
que é novo é o **F**:

### F) `GET /sinal` — o lado da rota que nunca dormiu

O `POST` do `/sinal` devolve 501 sem gateway antes de tocar em qualquer coisa.
O `GET` **não tem essa guarda**: respondia `{pago, confirmado}` de qualquer
reserva a quem tivesse o UUID, e o 404 contra o 200 dizia se ela existia. É o
único pedaço da posse que dá para exercitar de ponta a ponta **sem ligar o
PIX** — e é exatamente por isso que ele merecia cenário próprio.

- ✅ estranho com o id **não lê o sinal** — 403 `sem_posse`
- ✅ a dona **lê** — 200, `pago=false`, `confirmado=false` (o poll da tela do
  PIX continua funcionando para quem tem o comprovante)
- ✅ sem gateway, o `POST` é **501 para os dois**, com código `sem_gateway` —
  não `sem_posse`. É a prova empírica da ordem *gateway antes da posse*: um
  portal sem PIX não pode passar a distinguir dona de estranho, porque isso já
  seria contar se a reserva existe.

### O que esta execução NÃO cobre (além do que a de 14/09 já listava)

- O **`POST` do `/sinal` com gateway ativo** — a recusa 403 antes do
  `findUnique` e a criação da cobrança pela dona. Sem `PAGAMENTO_PROVIDER` o
  POST nunca passa do 501; esse caminho está coberto só pela unidade
  (`posse-sinal.test.ts`) e pela leitura do código. **Quando o PIX for
  ligado, este é o cenário a acrescentar antes do deploy.**
- `GET /api/bookings/[id]` pela **2ª porta** (cliente logada, outro aparelho).
  O D cobre a 2ª porta no `/confirm`; a guarda é a mesma função, mas o
  roteiro não a exercita nessa rota.

## C) Teto de reservas por IP

- ✅ 10 criações do mesmo IP passam; a **11ª toma 429**
- ✅ outro IP no mesmo instante **não é afetado** (201)
- ✅ a tela diz **quantos minutos faltam**, e não o antigo "Tenta de novo?" —
  que mandaria repetir na hora exatamente o que está sendo segurado

⚠️ Detalhe que só o teste com browser mostrou: o teto depende do header do
proxy. **Sem proxy na frente, `clientIp` devolve `null` e o teto não arma** — o
que é correto (não dá para punir um IP que não se conhece), mas significa que em
produção ele só existe porque o Traefik preenche o header. Se um dia o portal
for servido sem proxy, o teto vira no-op **em silêncio**.

🔒 E a revisão de segurança achou o buraco que o QA não pegou: `clientIp` lia o
**primeiro** item do `x-forwarded-for`, e o Traefik *acrescenta* o IP real ao
header que chegou em vez de apagá-lo. Quem mandasse o próprio `X-Forwarded-For`
ficava em primeiro e escolhia o próprio balde — girar esse valor contornava o
teto inteiro. Agora quem manda é o `x-real-ip`, que o Traefik **sobrescreve**
com o peer TCP. Dois testes travam isso (`tests/authlog.test.ts`), e a correção
vale também para o rate limit de login, que tinha a mesma falha.

## D) A segunda porta (cliente logada) é porta, não portão

A cliente logada no Clube confirma a própria reserva mesmo sem o comprovante —
cobre quem marca num aparelho e confirma em outro. O teste que importa é o
inverso:

- ✅ deslogada, sem comprovante: **403**
- ✅ **sessão provisória (1º acesso, senha = telefone): 403** — a porta não se
  apoia no elo mais fraco; a senha ainda é um número que qualquer pessoa sabe
- ✅ com senha própria, dona da reserva, outro aparelho: **200**
- ✅ **logada, reserva de OUTRA cliente: 403**

## E) "Não" na alergia não vira dado de saúde

Cenário acrescentado em 14/09/2026, depois que uma revisão de correção achou
que as duas definições de "alergia de verdade" no repositório discordavam.

- ✅ com **"Não"**, a caixinha de dado de saúde **nem aparece**
- ✅ com **"Não"**, ela **consegue agendar** — o bug barrava exatamente aqui
- ✅ com alergia de verdade, a autorização **é** pedida
- ✅ e, sem marcá-la, o agendamento é barrado — como deve ser

Detalhe do roteiro que vale copiar: as caixinhas são miradas **pelo texto do
label**, nunca por posição. Quando há alergia de verdade, a de dado de saúde
aparece *antes* da de privacidade no DOM, e um `.first()` marcaria a errada —
dando verde falso justamente no cenário que interessa.

## Como repetir

```bash
# 1. Postgres 16 (precisa de btree_gist — postgresql-contrib)
initdb -D <dir> -U mi --auth=trust && pg_ctl -D <dir> -o "-p 5433" start
createdb -h 127.0.0.1 -p 5433 -U mi miozorio_qa

# 2. .env.local apontando para ele, SEM as envs da Evolution/n8n
#    (é isso que garante que nenhum WhatsApp saia da sua máquina)
export DATABASE_URL="postgresql://mi@127.0.0.1:5433/miozorio_qa?schema=public"
npx prisma migrate deploy && npx tsx prisma/seed.ts
npm run test:db && npm run dev

# 3. o roteiro do browser
npm i --no-save playwright        # o repo não depende de playwright
node scripts/qa-agendar.mjs
```

## O que este QA NÃO cobre

- **Produção.** Nada aqui roda contra `miozorio.com.br`. O deploy segue sendo
  gate de OK explícito do Rodolfo (`claude.md`).
- **Navegador com cookies bloqueados.** Do lado do servidor é o mesmo caso do
  cenário B (403, reserva de pé, a Mi confirma pelo painel), mas ninguém
  exercitou a experiência real dessa cliente.
- **Sinal/PIX.** Sem gateway configurado (R22), a reserva com sinal nem chega a
  `/confirm` — o wizard para antes. Caminho inalterado por estas mudanças.
