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
  + PostgreSQL 16 + migrations SQL manuais quando preciso (no_overlap/btree_gist)
- **Luxon** (tz), **Zod**, **NextAuth v4** (admin credentials+bcryptjs), **Vitest**
- Fontes via `next/font/google`: Cormorant Garamond (títulos) + Jost (corpo)

## Regras críticas — v2 (R1–R10) + v3 (R11–R20)
- **R1/R14** Noiva e debutante NUNCA agendáveis online — só CTA WhatsApp (travado no backend).
- **R2** Double-booking impedido **no banco** (`EXCLUDE USING gist`), nunca só no app.
- **R3/R15** Zero hardcode — tudo em `business_settings`/`services`.
- **R4/R16** UTC no banco; exibição `America/Sao_Paulo` (Luxon).
- **R5** Telefones E.164 (`normalizeE164BR`) antes de qualquer uso.
- **R6/R18** Alergia = dado de saúde (LGPD): só autenticado; menores exigem responsável;
  foto de cliente só com `photo_consent` registrado.
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

## Arquitetura (mapa rápido)
- `src/lib/` — motor: `slots.ts` (on-the-fly), `booking-service.ts` (transições auditadas),
  `policies.ts` (puras), `settings.ts` (cache 60s), `availability.ts`, `phone.ts`,
  `auth.ts` (`requireAdmin` em toda server action/rota admin)
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
1. Preços/durações do dia a dia (escova, hidratação, sobrancelhas… hoje `pending_price`).
2. Dias/horários da linha dia a dia (janela própria em dias de semana).
3. Pacote de fotos (hero, retrato, portfólio, estúdio) + logo vetorial.
4. Depoimentos reais com autorização de nome.
5. E-mail de envio (reset de senha M13) — e gateway PIX (MP vs Efí) para o futuro F7.

## Scripts
`npm run dev | build | lint | typecheck | test | format | prisma:generate | prisma:migrate`
(husky pre-commit roda lint+typecheck; suíte do motor = `npm test`, 13 testes)

**Reset de senha do admin (caminho OFICIAL):** `scripts/reset-admin-password.ts`.
A senha entra **só em runtime** (sem hardcode/default), e-mail normalizado, hash
bcryptjs/rounds 12 (mesma config do login), zera o lockout. Não loga senha/hash.
Uso: `ADMIN_EMAIL="..." NEW_ADMIN_PASSWORD="..." npx tsx scripts/reset-admin-password.ts`
(rodar onde o `DATABASE_URL` aponta pro banco certo; ⚠️ nunca commitar `.env*`).
Obs.: o bootstrap do seed só **cria** o admin se não existir — **não** troca a
senha de conta existente; para resetar, use este script.
