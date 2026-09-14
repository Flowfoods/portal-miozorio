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

- **`POST /api/bookings/[id]/sinal` não checa dono** — a mesma classe de IDOR
  que o comprovante de posse fechou no `/confirm`, na rota vizinha. Verificado,
  **não consertado**.

  Hoje está adormecido: sem gateway (R22) o POST devolve 501 antes de tocar em
  qualquer coisa. O `GET` já responde `{pago, confirmado}` para qualquer id de
  reserva, o que vaza pouco — mas vaza.

  ⚠️ **Ligar o PIX (item 6 do Anexo A) acorda o buraco**: com gateway ativo,
  quem tiver um UUID de reserva gera cobrança PIX na reserva de outra pessoa e
  sobrescreve `depositProvider`/`depositPaymentId` dela. O conserto é o mesmo
  `podeConfirmar` do `/confirm` — não foi feito aqui para não inchar um PR que
  já estava pronto, e porque a rota está inerte enquanto o gateway estiver
  desligado. **Fazer junto com a decisão do gateway, não depois.**

- As quatro dívidas registradas em 15/08/2026 estão todas fechadas.
