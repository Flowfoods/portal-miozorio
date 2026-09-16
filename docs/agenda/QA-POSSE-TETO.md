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
