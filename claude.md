# claude.md — Portal Mi Ozorio (convenções do repo)

> ⚠️ **Nunca commitar segredos aqui** (R9). Valores reais (DATABASE_URL, chaves,
> tokens, senhas) ficam só no Dokploy / `.env` local / memória local do Claude
> Code do Rodolfo. Este arquivo guarda convenções, arquitetura e decisões.

## O que é

Portal completo (vitrine + agendamento + painel) da **Milene Ozorio Beauty
Artist** (maquiadora/cabeleireira, Santíssimo/RJ). Projeto FlowFoods.
**Em produção: https://miozorio.com.br** (painel da Mi em `/admin`).
v2 (M0–M7) entregou M0–M6; v3 (M8–M14) em andamento — evolução incremental.

## Skills obrigatórias (carregar antes de codar)

`miespecialista` (negócio: serviços, preços, tom, políticas) e `booking-engine`
(regras de ouro do motor). Dúvida de negócio → a skill decide; sem cobertura →
placeholder `<!-- APROVAR COM A MI -->`, nunca inventar preço/política/copy.

## Stack

- **Next.js 14.2.35** (App Router, `src/`, output **standalone**) + TS estrito
- **Tailwind 3.4** + tokens da marca (`src/styles/tokens.css`, `tailwind.config.ts`)
- **Prisma 6** (⚠️ NÃO migrar p/ v7 — removeu `url` do datasource; downgrade já feito)
  - PostgreSQL 16 + migrations SQL manuais quando preciso (no_overlap/btree_gist)
- **Luxon** (tz), **Zod**, **NextAuth v4** (admin credentials+bcryptjs), **Vitest**
- Fontes via `next/font/google`: Cormorant Garamond (títulos) + Jost (corpo)

## Regras críticas — v2 (R1–R10) + v3 (R11–R20)

- **R1/R14** Noiva e debutante NUNCA agendáveis online — só CTA WhatsApp (travado no backend).
- **R2** Double-booking impedido **no banco** (`EXCLUDE USING gist`), nunca só no app.
  `bookings.professional_id` é **NOT NULL** e tem que continuar assim: a trava
  compara `professional_id WITH =`, e `NULL = NULL` não é verdadeiro em
  PostgreSQL — reserva sem profissional escapa da trava **em silêncio**.
- **R3/R15** Zero hardcode — tudo em `business_settings`/`services`.
- **R4/R16** UTC no banco; exibição `America/Sao_Paulo` (Luxon).
- **R5** Telefones E.164 (`normalizeE164BR`) antes de qualquer uso.
- **R6/R18** Alergia = dado de saúde (LGPD): só autenticado; menores exigem responsável;
  coleta pública exige consentimento ESPECÍFICO (`lib/consentimento-saude.ts`,
  `booking.health_consent_at`) — o aceite genérico da política não cobre dado
  sensível (art. 11, I). Só é pedido a quem escreve alergia de fato;
  foto de cliente só com `photo_consent` registrado.
  ⚠️ **"Alergia de verdade" tem fonte única: `anamnesis.ts:ehNegacao`.**
  "Não"/"nenhuma"/"-" não são dado de saúde — não exigem consentimento nem
  carimbam `health_consent_at`. O alerta da agenda e a trava do agendamento
  TÊM que concordar: já divergiram, e a cliente que respondia "Não" simplesmente
  não conseguia agendar.
- **R7/R20** Voz da Mi: acolhedora + sofisticada, "você", 💛 com moderação.
- **R8** Commits pequenos por sub-fase, pt-BR (`M10.1: encaixe manual - tela`).
- **R9** Segredos só Dokploy/`.env` — nunca no Git.
- **R10** Idempotência em webhook/notificação (`notification_log.dedup_key`).
- **R11** Nada quebra o que está no ar: migration só aditiva; suíte do motor verde antes de deploy.
- **R12** Identidade: branco/bege `#F5F0E8`/cinza `#E8E6E3`/marrom `#8A7361`/`#5C4A3D`;
  Cormorant 500–600 + Jost 300–400; vibe @anaveiga; antiexemplo: rosa choque, ícone de estoque.
  Guia completo + backlog visual: `docs/GUIA-VISUAL.md`.
- **R13** Zero jargão na UI da Mi ("horário", nunca "slot"/"booking"/"lead").
- **R17** Toda transição de status via `booking-service` → `booking_events` (admin grava `actor: 'admin'`).
- **R19** Mobile-first real: validar telas novas em 390px antes do DoD (a Mi opera pelo celular).
- **R21 ⚠️ NUNCA adicionar valor ao enum `BookingStatus`.** A trava
  anti-double-booking e o índice de disponibilidade são PARCIAIS:
  `WHERE status IN ('pending','confirmed')`. Um status novo cai **fora** dos
  dois — o horário deixa de ser protegido contra sobreposição e some das
  consultas de disponibilidade, em silêncio. Estado novo vira **coluna/flag**
  com o booking seguindo em `pending` (ver `variantId`+`sizeApprovedAt` e
  `cancelledBy`), e o rótulo da tela é derivado.
- **R22** Sinal: o portal só cobra se houver gateway configurado. Sem
  `PAGAMENTO_PROVIDER`, `gatewayAtivo()` devolve null e o fluxo é o do WhatsApp.
  Nunca mostrar botão de pagar sem gateway ativo.

## Arquitetura (mapa rápido)

- `src/lib/` — motor: `slots.ts` (on-the-fly), `booking-service.ts` (transições auditadas),
  `policies.ts` (puras), `settings.ts` (cache 60s), `availability.ts`, `phone.ts`,
  `auth.ts` (`requireAdmin` em toda server action/rota admin)
- **Auth (B1–B5, ver `docs/AUTH-B1-B5.md`):** `auth-identidade.ts` normaliza
  telefone/e-mail/senha (fonte única, cadastro e login); `auth-cookies.ts` define
  os atributos do cookie e o host canônico; `auth-rotas.ts` valida `callbackUrl`;
  `recuperacao.ts` é o **módulo único** de recuperação de senha de TODOS os
  perfis. Regra inviolável: o código de 6 dígitos vai para o WhatsApp da **Mi**,
  que repassa à pessoa no número cadastrado — nunca direto para quem pediu.
- **Posse da reserva (`posse-reserva.ts`):** `/api/bookings` emite um comprovante
  HMAC em cookie httpOnly e `/confirm` o exige — id de reserva na mão não
  confirma mais reserva alheia. Não é sessão (não identifica ninguém, não vale
  para outra reserva); emitir é best-effort, porque a reserva já está no banco
  quando o comprovante é assinado. O teto de reservas por IP (`authlog.ts`,
  `RESERVA_IP_MAX`) fecha o que o teto por telefone não alcança — quem troca o
  telefone a cada POST — e reusa o `auth_log` (a coluna `event` é String: evento
  novo não pede migration).
- `src/app/api/` — público: availability, bookings (+confirm/cancel), services, health, NextAuth
- `src/app/admin/` — painel (server components + `actions.ts`): Agenda, Serviços (CRUD),
  Bloqueios, Clientes (strikes/perdoar), Usuárias, Configurações
- `prisma/seed.ts` — idempotente; entrypoint roda `--if-empty` no boot; admin bootstrap
  via `ADMIN_EMAIL`/`ADMIN_PASSWORD`

## Deploy (Dokploy · VPS Hostinger compartilhada c/ Megashopper/Bibi/n8n/Evolution)

- App `portal-miozorio` (applicationId `rQ_sgLhWZyb6ihF0nbs4a`, projeto `miozorio`);
  banco no container interno `miozorio-pgmiozorio-p6ecqh` (postgres:16 pinado, btree_gist).
- Build = **Dockerfile** multi-stage; entrypoint roda `prisma migrate deploy` + `seed --if-empty`
  → migrations/seed 100% automáticos no boot. Prisma CLI vive em stage isolado (`prisma-cli/`).
- Fluxo: branch `feat/v3-mX-nome-curto` → PR → merge master → `application.deploy` (API tRPC)
  → health `https://miozorio.com.br/api/health` → smoke test mobile 390px.
- **Gates (OK explícito do Rodolfo):** mudança de schema em prod, deploy, scripts de limpeza,
  qualquer ação em infra compartilhada (ex.: reload do Traefik).
- Lições da API Dokploy: zod exige TODOS os campos (null ok, ausente 400);
  `settings.reloadTraefik` payload `{}` destrava cert preso; logs de build via
  websocket `/listen-deployment?logPath=...` (header x-api-key).

## Ambiente local (Windows do Rodolfo)

- `npm run dev` (sem banco local: /agendar e /admin degradam — teste funcional é em prod).
- Preview MCP: usar shim `C:\Users\RODOLF~1\npmsh.cmd` no `.claude/launch.json`
  (caminho com espaço de "Program Files" quebra spawn sem aspas).
- CRLF warnings do git são normais; arquivos novos sempre LF.

## Pendências de negócio (Anexo A da v3 — confirmar com a Mi)

> Diagnóstico de 14/09/2026 em `docs/ANEXO-A-DIAGNOSTICO.md`: o que o portal faz
> hoje na ausência de cada decisão e quem destrava. Resumo: só o adaptador da Efí
> é trabalho de código; a janela de dias de semana já existe e é configuração.

1. Preços/durações do dia a dia (escova, hidratação, sobrancelhas… hoje `pending_price`).
2. Dias/horários da linha dia a dia (janela própria em dias de semana).
3. Pacote de fotos (hero, retrato, portfólio, estúdio) + logo vetorial.
4. Depoimentos reais com autorização de nome.
5. Pendências de auth em `docs/AUTH-B1-B5.md` (validade do código, tempo de
   sessão). O antigo item "e-mail de envio para o reset M13" saiu da lista:
   o reset por e-mail deixou de existir (B2 — o código vai pelo WhatsApp da
   Mi). O Resend segue só para o aviso "sua senha foi alterada".
6. **Gateway PIX (MP × Efí):** o adaptador do Mercado Pago está pronto e
   DESLIGADO (R22). Falta a decisão + credenciais; Efí = escrever
   `src/lib/pagamento/efi.ts` com a mesma interface.
7. **Quais serviços exigem sinal** — a migration desligou todos; a regra de
   reincidência (3 cancelamentos) segue automática e independe da flag.

## Frente de agendamento (2026-09-13) — A1–A11

Diagnóstico: `docs/agenda/FASE1-DIAGNOSTICO.md` · verificação:
`docs/agenda/FASE3-VERIFICACAO.md` · deploy: `scripts/deploy-agenda.sh` +
`docs/agenda/RUNBOOK-DEPLOY.md` · ligar PIX: `docs/agenda/ATIVAR-PIX-MERCADOPAGO.md`.
- **Notificações:** `notify-mi.ts` (para a Mi) e `notify-cliente.ts` (para a
  cliente) — ambas best-effort, idempotentes por dedupeKey, pelo outbox.
  WhatsApp que não sai NUNCA derruba a criação de um agendamento.
- **Pagamento:** porta em `lib/pagamento/tipos.ts`, adaptador MP em
  `mercadopago.ts`. Trocar de provedor = arquivo novo + env (R22).
- **Serviços:** `archivedAt` (some de tudo, histórico preservado) ≠ `active`
  (liga/desliga, fica no admin). Nome duplicado barrado no backend por
  `chaveServico()`.
- **Crons novos:** `/api/cron/conciliar-sinais` (10 min; no-op sem gateway).
- **Envs novas:** `PAGAMENTO_PROVIDER`, `MP_ACCESS_TOKEN`, `MP_WEBHOOK_SECRET`
  (ver `.env.example`). Sem elas, comportamento idêntico ao de antes.

## Scripts

`npm run dev | build | lint | typecheck | test | format | prisma:generate | prisma:migrate`
(husky pre-commit roda lint+typecheck)

- `npm test` — **526 testes**, sem banco. Roda em qualquer lugar.
- `npm run test:db` — **21 testes de integração** contra Postgres de verdade
  (`tests/integration/*.itest.ts`, exige `DATABASE_URL`). Cobrem a R2, que mora
  numa constraint e não no código: mockar o Prisma testaria o mock.

**CI** (`.github/workflows/ci.yml`, todo PR e push p/ master): job `verificacao`
(lint, typecheck, 526 testes, build) + job `integracao` (postgres:16, aplica as
migrations de verdade e roda os 21). O repo não tinha CI até 13/09/2026 — um
`--no-verify` passava direto e migration com erro de SQL só aparecia no boot do
container em produção.

**Limpeza de serviços duplicados:** `scripts/dedup-servicos.ts` — DRY-RUN por
padrão (só relata); `--aplicar` executa. Elege o sobrevivente por mais
histórico, re-aponta bookings/itens/turmas/fila e **arquiva** os demais (nunca
apaga). Idempotente.

`npm run dev | build | lint | typecheck | test | format | prisma:generate | prisma:migrate`
(husky pre-commit roda lint+typecheck; suíte completa = `npm test`)

**Reset de senha do admin (caminho normal):** `/admin/recuperar` → código de 6
dígitos no WhatsApp da Mi → nova senha (mesmo fluxo da cliente). O antigo link
por e-mail e a rota `/admin/redefinir/[token]` **não existem mais**.

**Reset de emergência (sem acesso a nada):** `scripts/reset-admin-password.ts`.
A senha entra **só em runtime** (sem hardcode/default), e-mail e senha
normalizados igual ao login, hash bcryptjs/rounds 12, zera o lockout e sobe o
`token_version` (derruba as sessões). Não loga senha/hash.
Uso: `ADMIN_EMAIL="..." NEW_ADMIN_PASSWORD="..." npx tsx scripts/reset-admin-password.ts`
(rodar onde o `DATABASE_URL` aponta pro banco certo; ⚠️ nunca commitar `.env*`).
Obs.: o bootstrap do seed só **cria** o admin se não existir — **não** troca a
senha de conta existente; para resetar, use este script.
