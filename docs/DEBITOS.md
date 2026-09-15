# Débitos técnicos (fora de escopo — anotados, não corrigidos)

- ~~SEO: canonical das subpáginas (`/agendar`, `/noivas`) aponta para a home~~ —
  **resolvido antes de virar dívida**: as 9 rotas públicas declaram canonical
  próprio via `pageMeta` (`src/lib/seo.ts:24`) e o layout raiz deliberadamente
  não declara (senão seria herdado por todas). Verificado na revisão de
  15/08/2026.

## Adiados conscientemente na execução do plano de resolução (15/08/2026)

- ~~**`professional_id NOT NULL` no banco.**~~ — **resolvido em 13/09/2026**
  (`20260913080000_professional_obrigatorio`). A trava anti-double-booking é
  `EXCLUDE ... professional_id WITH =`, e em PostgreSQL `=` com NULL nunca
  conflita — um booking sem profissional desarmava a R2 em silêncio.

  A dependência de "conferir o banco de produção primeiro" foi resolvida sem
  acesso ao banco: a migration se defende sozinha. Antes de escrever qualquer
  coisa ela pergunta se o backfill criaria sobreposição — considerando tanto
  pares NULL × NULL quanto NULL × preenchida — e, se criaria, aborta com uma
  mensagem que nomeia o par. Um par assim é um double-booking que já existe na
  agenda; quem escolhe qual fica é a Mi, não uma migration. Abortar deixa o
  banco intocado e o Dokploy mantém a versão anterior.

  `scripts/deploy-agenda.sh` roda a mesma conferência no pré-voo, só leitura,
  para o problema aparecer antes do deploy e não no boot do container.

  Os quatro cenários foram exercitados contra um PostgreSQL 16 real (produção
  limpa · NULLs sem conflito · NULL × NULL · NULL × preenchida) e três testes
  de integração novos travam o resultado. ⚠️ **Ainda exige o OK do Rodolfo**
  como toda mudança de schema em produção.

- **Posse na confirmação (`POST /api/bookings/[id]/confirm`).** A rota não checa
  quem chama. O dano é contido por desenho — ela fixa o ator em `system`, então
  hold vencido é recusado, e a janela é de poucos minutos com um UUID v4 que só
  a própria cliente recebeu.

  **Resolvido em 14/09/2026** (`src/lib/posse-reserva.ts`). Quem cria recebe um
  comprovante — HMAC-SHA256 do próprio id da reserva mais a validade, em cookie
  httpOnly — e `/confirm` passa a exigi-lo. **Não é sessão**: não diz quem é a
  pessoa, não vale para outra reserva e morre junto com o horário guardado.
  Assinado e não sorteado de propósito: nada de novo no banco, nada a limpar
  depois, e um comprovante vazado não abre nenhuma outra porta.

  O medo registrado na dívida era quebrar o caminho que gera receita. Três
  decisões existem só para isso:
  - **Emitir o comprovante é best-effort.** Quando o código chega lá a reserva
    já está no banco e a Mi já foi avisada; deixar uma exceção subir devolveria
    500 para um agendamento que existe, e a cliente tentaria de novo até bater
    no teto por telefone achando que nada funcionou.
  - **O comprovante vive 30 min a mais que o hold.** Quem chega atrasado lê "o
    tempo da reserva expirou" (410, que explica), não "não consegui confirmar
    por aqui" (403, que é a resposta para quem não é dono).
  - **Segunda porta para a cliente logada** no Clube que seja dona da reserva —
    o comprovante mora num navegador só, e quem marca pelo portal e confirma de
    outro aparelho não pode ficar de fora do próprio agendamento.

  Sobra um caminho pior do que antes: navegador com cookies bloqueados toma 403.
  A reserva continua de pé e a Mi confirma pelo painel (`actor: "business"`),
  que é o mesmo caminho do encaixe manual.

  O **QA logado ponta a ponta** que a dívida pedia **foi executado** em
  14/09/2026 contra um PostgreSQL 16 de verdade, num Chromium real em 390px:
  21 asserções, todas verdes, incluindo o teste que separa "fechei o buraco" de
  "quebrei a rota" — a dona confirma normal, e a cliente logada **não** confirma
  reserva alheia. Evidência e como repetir: `docs/agenda/QA-POSSE-TETO.md`,
  roteiro em `scripts/qa-agendar.mjs`. Os 21 testes de integração também
  rodaram, com as 10 migrations aplicadas do zero.

- ~~**Rate limit por IP em `POST /api/bookings`.**~~ — **resolvido em
  14/09/2026** (`RESERVA_IP_MAX`/`throttleDeReservaPorIp` em `authlog.ts`).
  O honeypot e o teto por telefone cobrem o abuso realista, mas não alcançam
  quem troca o telefone a cada POST — e cada reserva nova segura um horário
  durante todo o hold.

  A dívida dizia "exige um evento novo no `AuthEvent`, então não é
  plug-and-play". O evento novo (`booking_create`) saiu **sem migration**:
  `auth_log.event` é `String` no schema, não enum, e o índice
  `[ip_hash, created_at]` que a consulta usa já existe.

  ⚠️ **Achado do QA no browser:** o teto depende do header do proxy. Sem proxy
  na frente, `clientIp` devolve `null` e o teto **não arma** — correto (não dá
  para punir um IP que não se conhece), mas quer dizer que em produção ele só
  existe porque o Traefik preenche o header. Servir o portal sem proxy
  transforma o teto em no-op **em silêncio**.

  🔒 **E a revisão de segurança achou o buraco de verdade:** `clientIp` lia o
  **primeiro** item do `x-forwarded-for`. O Traefik *acrescenta* o IP real ao
  header que chegou, sem apagar o que veio — então quem mandasse o próprio
  `X-Forwarded-For` ficava em primeiro e **escolhia o próprio balde**. Girar
  esse valor contornava o teto inteiro, de graça. Agora `x-real-ip` (que o
  Traefik **sobrescreve** com o peer TCP) manda, e o `x-forwarded-for` é só
  reserva. Vale também para o rate limit de login, que tinha a mesma falha.

  Conta **criações**, não tentativas: quem erra o formulário cinco vezes não
  pode ficar sem conseguir marcar. Teto folgado (10 por hora) porque o CGNAT das
  operadoras põe muita cliente atrás do mesmo IP — o número existe para
  transformar centenas de horários travados em dez, não para policiar quem marca
  duas vezes. Best-effort como o resto do `authlog`: falha de consulta libera.

- ~~**Alergia coletada no formulário público com o checkbox genérico de LGPD.**~~
  — **resolvido em 13/09/2026** (`20260913090000_consentimento_saude`).
  Alergia é dado de saúde e, pela LGPD, sensível (art. 5º, II): o tratamento por
  consentimento exige que ele seja "específico e destacado" (art. 11, I), e o
  aceite genérico da política não é nem um nem outro.

  A regra vive em `src/lib/consentimento-saude.ts` (módulo puro) e é aplicada
  no `booking-service`, **antes de qualquer consulta ao banco** — a rota é
  pública e qualquer cliente HTTP monta o POST sem passar pelo formulário.
  `booking.health_consent_at` registra o aceite.

  Desenho: o consentimento extra só é exigido de quem **de fato escreve** uma
  alergia. Campo em branco não coleta dado sensível, então não há o que
  consentir — e pedir autorização de dado sensível para todo mundo seria ruído,
  que é justamente o que treina as pessoas a clicar sem ler. Nunca carimbamos
  consentimento não pedido: auditoria de LGPD com data inventada é pior do que
  auditoria vazia.

  ⚠️ **`<!-- APROVAR COM A MI -->`** o texto da autorização
  (`AgendarWizard.tsx`, passo 3) — a dívida dizia que a copy dependia dela.
  O que está lá é proposta, não decisão.

## Resolvidos depois

- ~~**Alergia de terceiro no formulário de indicação** (`IndicarForm.tsx`)~~ —
  **resolvido em 14/09/2026**, mas a dívida estava **errada no diagnóstico** e
  isso importa mais que o conserto.

  A dívida dizia: *"quem indica escreve a alergia da amiga; consentimento de
  dado sensível não pode ser dado por outra pessoa adulta"*. **Não é o que
  acontece.** `/indicar/[codigo]` é a tela da **indicada** — título "Você foi
  indicada", campos "Seu nome" e "Seu WhatsApp", e `submitReferral` chega a
  recusar o número da própria embaixadora (*"Esse é o seu próprio número 💛
  indique uma amiga!"*). Quem preenche é a titular do dado. Ninguém consentia
  por ninguém.

  O problema real era **outro, e do mesmo tipo que a R6/R18 já resolve**:
  alergia é dado sensível, e ali o único aceite era o checkbox genérico da
  política — o que o art. 11, I não aceita. Era a mesma falha do formulário
  público de agendamento, num caminho que a correção de 13/09 não alcançou.

  **Conserto: o campo saiu.** Dois motivos para não reaproveitar
  `consentimento-saude.ts` aqui:
  - `health_consent_at` vive em `booking`. Guardar o aceite de uma *customer*
    pediria coluna nova — mudança de schema em produção para um dado que vai ser
    perguntado de novo daqui a pouco.
  - Este formulário é público e **não prova posse do telefone** (a mesma razão
    pela qual `submitReferral` já se recusava a carimbar `lgpdConsentAt` da
    cliente existente). Aceite de dado sensível colhido sem prova de quem é a
    pessoa vale pouco.

  Nada se perde: a anamnese acontece quando ela mesma marca o horário, com o
  consentimento específico exigido de quem de fato escreve uma alergia.

- ~~**"Não" na alergia era tratado como dado de saúde.**~~ — **resolvido em
  14/09/2026**, achado por uma revisão de correção. Não era dívida registrada:
  era bug vivo, introduzido junto com a própria correção de LGPD do #106.

  Havia **duas definições de "alergia de verdade"** no repositório, e elas
  discordavam. `anamnesis.ts` (A11) filtra negações — "Não", "nenhuma", "-" —
  justamente para o alerta da agenda não acender à toa. `consentimento-saude.ts`
  tratava **qualquer texto não-vazio** como dado sensível.

  Para a cliente que respondia "Não", a mais comum de todas: aparecia a caixinha
  de dado de saúde e, sem marcá-la, **ela não conseguia agendar**. Marcando,
  o portal gravava `health_consent_at` para um dado que a A11 já havia decidido
  que não existe — a auditoria inventada que aquele módulo foi escrito para
  evitar.

  Conserto: `ehNegacao` sai do `anamnesis.ts` como fonte única e é usado pelos
  dois lados, mais a tela (a caixinha nem aparece para negação). O viés
  conservador da A11 vale nos dois usos: só a lista fechada apaga, texto
  ambíguo continua contando como alergia de verdade — o lado seguro tanto para
  o alerta quanto para a LGPD. Um teste compara os dois módulos e cai se eles
  divergirem de novo; o roteiro de QA cobre o caso na tela.

  ⚠️ **Confira as reservas já carimbadas à toa** antes de confiar na auditoria:

  ```sql
  select id, anamnesis->>'alergia' as alergia, health_consent_at
  from bookings where health_consent_at is not null
  order by health_consent_at desc;
  ```

  Toda linha cuja alergia seja uma negação pura tem consentimento registrado
  sem dado sensível correspondente. Não apaguei nada: decidir entre limpar o
  carimbo ou deixá-lo com nota é do Rodolfo, e depende de o #106 já ter subido.

## Ainda abertos

- ~~**`POST /api/bookings/[id]/sinal` não checa dono**~~ — **resolvido em
  15/09/2026**, antes de a decisão do gateway acordar o buraco, como a própria
  dívida pedia. Sem migration e sem env nova.

  A guarda saiu de dentro do `/confirm` (onde era uma função local chamada
  `podeConfirmar`) para `src/lib/posse-reserva-guarda.ts`, e as **três** rotas
  públicas sob `/api/bookings/[id]` passaram a importá-la. A decisão da segunda
  porta virou `sessaoEDona`, pura, em `posse-reserva.ts` — separada porque é ela
  que precisa de teste e é ela que não pode divergir de uma rota para a outra.

  Além do `POST` que a dívida nomeava, entraram os dois GETs:

  - **`GET .../sinal`** — a dívida já o registrava como "vaza pouco, mas vaza".
    Ele é o único lado que **nunca esteve adormecido**: não tem a guarda de
    gateway que devolve 501 no POST, então respondia `{pago, confirmado}` de
    qualquer reserva, e o 404 contra o 200 dizia de graça se ela existia.
  - **`GET /api/bookings/[id]`** — não estava registrado em lugar nenhum.
    Devolve `status`, `startsAt` e `endsAt`, ou seja, **o horário marcado de
    outra pessoa** a quem tivesse o UUID. Nenhuma tela a consome hoje (o wizard
    faz poll pelo `/sinal`), e é por isso mesmo que ela entrou: rota pública
    esquecida é a que volta a ser usada sem ninguém lembrar que nunca checou
    dono.

  Ordem que importa e está travada por comentário nas três: no POST do `/sinal`
  o `gatewayAtivo()` vem **antes** da posse, para que um portal sem PIX continue
  respondendo 501 igual para todo mundo sem tocar no banco; a posse vem **antes**
  do `findUnique`, para o 403 não depender de a reserva existir.

  17 testes novos (`tests/posse-sinal.test.ts`), entre eles uma varredura que
  exige a guarda no corpo de **cada handler** exportado sob `[id]` — a versão
  frouxa dela (uma chamada por arquivo) passaria com o `GET` do `/sinal` aberto
  e o `POST` fechado, que é exatamente a forma como este buraco existiu.
  Conferido por mutação: cada conserto foi quebrado e o teste caiu.

  **QA ponta a ponta executado** (`docs/agenda/QA-POSSE-TETO.md`, seção de
  15/09): Postgres 16 real + Chromium, **34 asserções**, duas execuções a partir
  do estado zerado. O cenário **F** exercita o `GET /sinal` — estranho 403, dona
  200 — e prova que sem gateway o `POST` é 501 igual para os dois. O que
  **continua sem QA de browser** é o `POST /sinal` com gateway ligado: entra
  como cenário obrigatório do roteiro **no dia em que o PIX for ativado**.

  **Revisão adversarial do diff (15/09, à tarde).** Cinco lentes independentes
  leram o commit; quatro chegaram ao fim — a de documentação e **todos os
  céticos** caíram no limite de uso da sessão. Logo, o que segue foi
  **verificado por leitura de código, não por votação**. Quatro achados
  viraram conserto no mesmo PR:

  - **A 2ª porta consultava o banco antes de recusar a sessão provisória.** O
    resultado era o mesmo do `podeConfirmar` antigo, mas o I/O não — e a
    promessa "403 antes de qualquer consulta" só valia para o caminho anônimo.
    A guarda agora recusa sessão nula ou provisória **sem** consultar; e
    `getClienteSession` que lança (segredo ausente com cookie do Clube no
    navegador) vira 403, não 500 — antes, as três rotas responderiam 500 nesse
    estado.
  - **A copy do 403 do `POST /sinal` duplicava o CTA.** O wizard já emenda
    "Seu horário continua guardado — fale com a Mi no WhatsApp" a todo erro do
    PIX, e "abra no mesmo aparelho em que você marcou" era conselho impossível
    de seguir naquela tela. Ficou "Não consegui gerar o PIX por aqui."
  - **O poll do `GET /sinal` engolia o 403 como rede instável** (`if (!r.ok)
    return`) e deixava "esta tela confirma sozinha" como promessa para sempre.
    Agora para no 403 e mostra a mensagem.
  - **A varredura de cobertura só enxergava `export async function`.**
    `export const GET =` e `export function GET` passariam sem guarda;
    `export { h as GET }` — forma que o NextAuth do próprio repo usa — idem.
    Reconhece as duas primeiras e recusa a terceira sob `[id]` com instrução.
    Comentário citando a guarda deixou de contar como guarda.

  `tests/posse-rotas.test.ts` (16) chama as **rotas de verdade**, com Prisma,
  sessão e gateway falsos, e **conta consultas**: prova que sem gateway o 501
  vem antes da posse, que nas três rotas o 403 vem antes do `findUnique`, e
  que sessão provisória não toca o banco. Sete mutações, sete quedas no teste
  certo — inclusive a que troca o handler para `export const GET = async` e
  confirma que a varredura o reconhece.

  **Lido, pré-existente e fora deste diff** — anotado, não corrigido:

  - `POST /sinal` seleciona `depositPaymentId` e nunca o reaproveita: a
    idempotência que o comentário da rota promete vive só no
    `X-Idempotency-Key` do Mercado Pago (`mercadopago.ts:67`). Com gateway
    ativo, a dona pode disparar o POST repetidas vezes. **Conferir junto com o
    item 6 do Anexo A, antes de ligar o PIX.**
  - Sessão provisória → senha própria é self-service sem prova do telefone (o
    #106/#108 já registram, 5.2): quem conhece o número toma a conta e, com
    ela, a 2ª porta. A posse não piora nem melhora isso.
  - `POST /api/bookings` liga a reserva ao cadastro que já tem aquele telefone
    e entrega o comprovante a quem fez o POST. É o desenho do agendamento
    público sem verificação de telefone — anterior à posse e independente dela.

  ⚠️ **Não auditado:** se alguma cobrança PIX já foi criada por terceiro, não dá
  para saber — `depositPaymentId` não guarda quem pediu. Com o gateway desligado
  desde sempre (R22), o POST nunca passou do 501, então a resposta prática é
  "não houve". Os dois GETs não deixam rastro em `auth_log`.

- As quatro dívidas registradas em 15/08/2026 estão todas fechadas.
