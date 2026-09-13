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
  a própria cliente recebeu. A correção (cookie httpOnly curto emitido na
  criação) mexe no caminho que gera receita, e o risco de quebrar o
  agendamento é maior do que o de um atacante que precisaria adivinhar o UUID.
  Fazer junto com um QA logado de ponta a ponta.

- **Rate limit por IP em `POST /api/bookings`.** Entrou honeypot e teto de
  reservas em aberto por telefone, que cobrem o abuso realista. O limite por IP
  exige um evento novo no `AuthEvent` (`isIpThrottled` só conta `login_fail` e
  `recover_fail`), então não é plug-and-play.

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
