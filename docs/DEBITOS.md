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

  ⚠️ **Achado do QA no browser:** o teto depende de `x-forwarded-for` /
  `x-real-ip`. Sem proxy na frente, `clientIp` devolve `null` e o teto **não
  arma** — correto (não dá para punir um IP que não se conhece), mas quer dizer
  que em produção ele só existe porque o Traefik preenche o header. Servir o
  portal sem proxy transforma o teto em no-op **em silêncio**.

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

## Ainda abertos

- **Alergia de terceiro no formulário de indicação** (`IndicarForm.tsx`): quem
  indica escreve a alergia **da amiga**. Consentimento de dado sensível não pode
  ser dado por outra pessoa adulta, então o conserto não é uma caixinha — é
  decidir se esse campo deve existir ali. Decisão de produto, com a Mi.
