# claude.md — Portal Mi Ozorio (convenções do repo)

> ⚠️ **Nunca commitar segredos aqui** (R9). Valores reais (DATABASE_URL, chaves,
> tokens) ficam só no Dokploy / `.env` local. Este arquivo guarda convenções,
> arquitetura e o histórico de decisões — sem credenciais.

## O que é
Portal completo (vitrine + agendamento + automações) para **Milene Ozorio Beauty
Artist** (maquiadora/cabeleireira, RJ). Projeto FlowFoods. Master prompt: M0→M7.

## Stack
- **Next.js 14.2.35** (App Router) + TypeScript estrito (`src/`)
- **Tailwind 3.4** + design tokens da marca (`src/styles/tokens.css`)
- **Prisma 7** (PostgreSQL 16) + migration SQL manual da constraint `no_overlap`
- **Luxon** (datas tz-aware), **Zod** (validação de inputs), **NextAuth** (admin)
- **Vitest** (unit) + Playwright (e2e, a partir do M2)
- Fontes via `next/font/google`: Cormorant Garamond (títulos) + Jost (corpo)

## Regras críticas (R1–R10) — válidas em todos os módulos
- **R1** Noiva e debutante NUNCA agendáveis online — só CTA WhatsApp.
- **R2** Double-booking impedido **no banco** (`EXCLUDE USING gist`), nunca só no app.
- **R3** Zero hardcode de preço/horário/política — tudo em `business_settings`/`services`.
- **R4** Horários em UTC; exibição em `America/Sao_Paulo`.
- **R5** Telefones em E.164 (`+5521...`) antes de qualquer uso (Evolution API).
- **R6** Dados de saúde (alergias) e de menores (debutantes) = sensíveis (LGPD).
- **R7** Tom da Mi: acolhedor + sofisticado, 💛 com moderação.
- **R8** Commits pequenos, conventional commits em PT-BR.
- **R9** Segredos só em `.env`/Dokploy — nunca no Git.
- **R10** Idempotência em todo webhook/notificação (`notification_log.dedup_key`).

## Infra (compartilhada com Megashopper)
- VPS Hostinger **76.13.230.78** · **Dokploy v0.29.1** · Traefik (Let's Encrypt).
- Mesmo box que já roda Megashopper (5 svc), FlowFoods/Bibi, **n8n** e **Evolution API**.
- Deploy alvo: 2 containers novos → `portal-miozorio` (Next.js) + `pg-miozorio` (Postgres 16).
- `evo-miozorio` = **nova instância na Evolution API existente** (não um container novo).

## Auditoria M0.1 (capacidade) — 2026-06-10
Via API Dokploy (somente leitura). Inventário de containers ativos: 3 Next.js +
Express + ml-collector (Megashopper), flowfoods, bibi-portal, `postgres:16`,
`n8nio/n8n:latest`, `atendai/evolution-api:latest`, + stack Dokploy. ~13 ativos.
- **Veredito:** box é plano 8GB+; portal Mi Ozorio adiciona só 2 containers leves →
  **folga adequada**. `free -h`/`df -h` exatos a coletar no deploy M0.3 (passo
  autorizado no container novo). Achados: imagens compartilhadas em `:latest`
  (n8n/evolution/baserow) — risco de estabilidade; `pg-miozorio` será **pinado** em
  `postgres:16.x` por causa da extensão `btree_gist` (R2).

## Pendências (confirmar com Rodolfo/Milene — não bloqueiam M0–M1)
1. Preços/durações de sobrancelha (design, henna, brow lamination) → criar com `pending_price`.
2. Gateway PIX (Mercado Pago vs Efí) — fluxo F7.
3. Logo "Mi" em vetor + banco de fotos profissionais.
4. Domínio definitivo (sugestão: `agenda.mileneozorio.com` + registrar `mileneozorio.com.br`).
5. E-mail para NextAuth/notificações administrativas.

## Scripts
`npm run dev | build | lint | typecheck | test | format | prisma:generate | prisma:migrate`
