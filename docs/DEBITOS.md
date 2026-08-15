# Débitos técnicos (fora de escopo — anotados, não corrigidos)

- ~~SEO: canonical das subpáginas (`/agendar`, `/noivas`) aponta para a home~~ —
  **resolvido antes de virar dívida**: as 9 rotas públicas declaram canonical
  próprio via `pageMeta` (`src/lib/seo.ts:24`) e o layout raiz deliberadamente
  não declara (senão seria herdado por todas). Verificado na revisão de
  15/08/2026.

## Adiados conscientemente na execução do plano de resolução (15/08/2026)

- **`professional_id NOT NULL` no banco.** A trava anti-double-booking é
  `EXCLUDE ... professional_id WITH =`, e em PostgreSQL `=` com NULL nunca
  conflita — um booking sem profissional desarma a R2 em silêncio. O código já
  não grava NULL (`ensureProfessional()` em `booking-service.ts`) e o seed
  garante a profissional antes do `--if-empty`. Falta a migration aditiva com
  backfill + `SET NOT NULL` para fechar por estrutura. **Depende de conferir o
  banco de produção primeiro** (quantos bookings já estão com NULL) e de
  autorização para mudar schema em produção.

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

- **Alergia coletada no formulário público com o checkbox genérico de LGPD.**
  Dado de saúde merece consentimento próprio. Armazenamento e acesso já estão
  corretos (só painel autenticado). Depende de decisão da Mi sobre a copy.
