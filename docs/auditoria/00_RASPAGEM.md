# 00 — Raspagem e Descoberta · Portal Mi Ozorio

> Produção: **https://miozorio.com.br** (o super-prompt citava `mileneozorio.com`,
> que **não existe** — confirmado). Levantamento feito a partir do código-fonte
> (mais preciso que raspagem cega) + verificação ao vivo via HTTP.

## Stack real
- **Next.js 14.2.35** (App Router, `src/`), TypeScript estrito, Tailwind 3.4
- **Prisma 6 + PostgreSQL 16** (container `pg-miozorio`)
- **NextAuth v4** (credenciais, JWT) · **Luxon** (TZ America/Sao_Paulo) · **Zod** · **Vitest**
- Fontes: **Cormorant Garamond** (títulos) + **Jost** (corpo) via next/font
- Marca: branco/bege `#F5F0E8`/cinza/marrom `#8A7361`/marrom-escuro `#5C4A3D`
- Deploy: **Dokploy** (Hostinger VPS 76.13.230.78) + Traefik; imagem standalone; `migrate deploy` + seed `--if-empty` no boot

## Mapa de rotas — público
| Rota | Função |
|------|--------|
| `/` | Home (hero, serviços, diferenciais, portfólio, depoimentos, vitrine) |
| `/agendar` | Wizard de agendamento (5 passos; `?servico=` pré-seleciona) |
| `/dia-a-dia` | Catálogo cabelo + sobrancelha |
| `/galeria` | Portfólio (media_assets) |
| `/noivas`, `/debutantes` | Vitrines (pacotes, FAQ) — **não agendáveis** (R1), CTA WhatsApp |
| `/clube`, `/clube/painel/[codigo]`, `/indicar/[codigo]` | Clube de Fidelidade (pontos) |
| `/sobre`, `/privacidade` | Institucional / LGPD |
| `/api/*` | health, services, availability, bookings, og, media, auth |

## Mapa de rotas — admin (`/admin`, protegido)
Agenda · Resumo · Serviços · Fotos · Textos · Pacotes · Depoimentos · Bloqueios ·
Clientes (+ ficha `[id]`) · Clube · Usuárias · Configurações · login/recuperar/redefinir.

## Modelos de dados (Prisma)
`BusinessSetting`, `Service` (+ `ServiceAvailability`), `Customer` (CRM + clube),
`Booking` (+ `BookingEvent`), `EventSession`, `Waitlist`, `AdminUser`, `MediaAsset`,
`Testimonial`, `SiteContent`, `Pacote`, `Faq`, `ReferralMilestone`, `ClubRedemption`,
`ClubReward`, `ClubTransaction`, `PasswordResetToken`, `NotificationLog`.

## Editável pela Mi (CMS) vs. código
- **Editável no `/admin`:** textos das páginas (`SiteContent`), pacotes/FAQs/ensaio,
  serviços/preços/pontos, fotos, depoimentos, disponibilidade por serviço,
  configurações de negócio, recompensas do clube.
- **Em código:** layout/estrutura, lógica do motor, JORNADA/DIFERENCIAIS da home (estáticos).

## Integrações
- **Evolution API dedicada** (`evo.miozorio.com.br`, instância `miozorio`) → WhatsApp.
- App → Evolution **direto** (`src/lib/notify.ts`), eventos `club_points` e `booking_confirmation`.
- n8n: workflows versionados em `n8n/` (opcional, p/ crons por tempo).

## Verificação ao vivo (HTTP)
Todas as rotas públicas respondem **200**; `/admin/*` → **307** (login). Headers de
segurança presentes; sitemap/robots/JSON-LD ok; `/api/services` = 14 serviços.
