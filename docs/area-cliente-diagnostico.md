# Área da Cliente — Fase 0: Diagnóstico e decisões de arquitetura

> Mapeamento do que existe (2026-07-03, master `e18dad5`) antes de evoluir o
> Clube Mi Ozorio para a "Área da Cliente". Regra: nada se reescreve — pontos,
> indicação, recompensas e resgate migram intactos.

## 1. O que JÁ existe (e será reaproveitado)

### 1.1 Autenticação da cliente — pronta, reusar como está

`src/lib/cliente-auth.ts` — **não é NextAuth** (correção ao prompt): sessão
própria em cookie httpOnly `mi_clube` assinado HMAC-SHA256, TTL 30 dias, senha
inicial = telefone com troca forçada, lockout progressivo, consent LGPD no 1º
acesso. **Isolamento por construção:** toda query filtra por
`getClienteSession().customerId` — cliente nunca passa id por URL. As rotas
novas (histórico, momentos) herdam esse padrão.

### 1.2 Ledger de pontos — pronto, só ganha motivos novos

`club_transactions`: saldo = SUM(pontos), **`tipo` é String livre** (não enum)
→ novos motivos `depoimento`, `foto`, `reagendamento` **não precisam de
migration**. Idempotência via `dedup_key` único (R10) — padrão a seguir:
`depoimento:<testimonialId>`. Resgate já é `$transaction` Serializable
(sem saldo negativo/double-spend). Valores configuráveis via
`business_settings` (`getSettings()`, cache 60s) — ex.: `clubPointsPerReferral`
já funciona assim; criar `club_points_depoimento` etc. no mesmo molde (R3).

### 1.3 Gancho de atendimento concluído — pronto

`booking-service.markCompleted()` (status `confirmed → completed`, auditado em
`booking_events`) já dispara: crédito de pontos do serviço
(`service:<bookingId>`), pontos de indicação, reconhecimento de receita —
tudo fail-safe (try/catch, não desfaz a conclusão). O nudge D+2 e o crédito de
depoimento entram nesse mesmo padrão.

### 1.4 Histórico de atendimentos — dados prontos, falta a tela

`bookings` por `customerId` com `status: completed`: data (`startsAt`),
serviço (`service.name` + `items[]` multi-serviço), local, valor snapshot.
Pontos ganhos no atendimento: lookup `club_transactions.dedup_key =
service:<bookingId>`. "Cliente desde": `clubJoinedAt` / primeiro completed.

### 1.5 Upload/storage — praticamente pronto (decisão abaixo)

`src/lib/media.ts` já tem os dois mundos:
- **Público**: `MEDIA_DIR` (volume Dokploy `miozorio-media` → `/app/media`),
  sharp: rotate EXIF → 1600px → WebP q82 (EXIF/geo removidos por conversão),
  servido por `/media/[...path]` com cache imutável.
- **Privado**: `MEDIA_DIR/priv` (`processPrivatePhoto`), traversal travado
  (`path.basename` + extensão), servido só por rota autenticada.
- Validação de mime por tabela (`ATTACHMENT_MIME`) já usada no Financeiro.

**Lacuna real:** validação de magic bytes explícita (hoje o sharp rejeita
não-imagem ao decodificar — suficiente na prática, mas registrar) e rate-limit
de upload por cliente (não existe).

### 1.6 Depoimentos — JÁ EXISTE um model (decisão abaixo)

`Testimonial` atual: `quote/author/published/sort`, **criado pela Mi no
/admin** (M12), renderizado na home via `getPublishedTestimonials()` (fallback
elegante sem banco). Não tem: cliente, booking, fotos, rating, moderação,
consent. **Não pode quebrar** — a home lê dele hoje.

### 1.7 Notificações WhatsApp — padrão já estabelecido

`src/lib/notify.ts` (`dispatchEvent`): envio **direto na Evolution API**
(env-gated: sem env → no-op), idempotente via `notification_log.dedup_key`.
CRM já tem `jornadas`/`jornada_etapas`/`envios_mensagem` com cron
(`/api/cron/jornadas`), gatilho `pos_atendimento` já previsto no enum, opt-in
(`whatsappOptIn`) respeitado. **Decisão:** novos avisos usam esse trilho
(dispatchEvent p/ transacional; jornada p/ cadência D+2/D+N) — não criar
workflow n8n paralelo do zero.

### 1.8 Rotas atuais do Clube (preservar todas)

| Rota | O quê |
|---|---|
| `/clube` | landing + adesão (JoinForm) |
| `/clube/entrar` | login da cliente |
| `/clube/conta` | **área logada atual** (print de referência): saldo, indique-e-ganhe, recompensas+resgate, extrato |
| `/clube/conta/senha` | troca de senha (forçada na 1ª) |
| `/clube/painel/[codigo]` | carteirinha por link (sem login) — v5 adicionou "Minha agenda" |
| `/indicar/[codigo]` | página da indicada |
| `/admin/clube` | catálogo de recompensas, resgates a entregar, ajuste manual |

### 1.9 Reagendamento — motor pronto

`/agendar?servico=<code>` pré-seleciona serviço no wizard (M9.4). RFV/cadência
já calculados (`rScore`, `rfvSegmento`, job diário). "Repetir esse cuidado" =
link com o code do serviço do booking. Noiva/debutante: `bookableOnline=false`
travado no backend (R1/R14) — a API `/api/services` nem os devolve.

## 2. Lacunas (o que realmente falta construir)

1. Fotos + moderação de depoimentos (model `TestimonialPhoto`, fila admin).
2. Fluxo da cliente: escrever/editar/excluir depoimento com fotos e consent.
3. Shell de navegação da área logada (hoje `/clube/conta` é página única).
4. Tela de histórico (dados prontos — item 1.4).
5. Rate-limit de envio (3 pendentes/cliente) e de upload.
6. Rota de foto com **gate por status no banco** (item 3.2).
7. Card "Hora de se cuidar de novo" (cadência RFV → CTA).
8. Badge de pendências no sidebar admin.

## 3. Decisões de arquitetura

### 3.1 Storage: volume local existente (NÃO S3)

Escala da Mi (dezenas de fotos/mês) não justifica S3. Fotos de depoimento
ficam **sempre em `priv/`** (nunca no público), processadas por
`processPrivatePhoto` (WebP 1600px, EXIF fora).

### 3.2 Servir foto: rota pública com gate no banco

Nova rota `GET /momentos/foto/[photoId]` consulta o banco: só responde se
`testimonial.status = aprovado` **e** `foto.aprovadaIndividualmente` **e**
consent válido; senão 404. Vantagens: exclusão/LGPD tem efeito imediato (sem
cópia pública órfã), aprovação não move arquivo. Cache curto
(`s-maxage=3600, stale-while-revalidate`) — revogação em ≤1h no edge, imediata
no origin. Fotos pendentes: servidas só à dona (sessão) e à Mi (admin).

### 3.3 Model: ESTENDER `testimonials` (aditivo), não criar tabela paralela

A home já lê dessa tabela; duas fontes de depoimento = deriva. Migration
aditiva: `customer_id?`, `booking_id?`, `rating?`, `status`
(`rascunho|pendente|aprovado|rejeitado|arquivado` — default `aprovado` p/
linhas legadas da Mi), `motivo_rejeicao?`, `consentimento_publico_at?`,
`destaque`, `moderado_em?/moderado_por?`, `origem` (`admin|cliente`).
`published` legado vira derivado (`status='aprovado'`) — manter a coluna
sincronizada na transição p/ não quebrar `getPublishedTestimonials` até o
refactor. Nova tabela só `testimonial_photos` (id, testimonialId, chave priv,
ordem, aprovadaIndividualmente).

### 3.4 Navegação: rotas aninhadas sob `/clube/conta` (sem feature flag)

```
/clube/conta            → Início (saudação, pontos-resumo, próximo horário, CTA agendar)
/clube/conta/historico  → linha do tempo (Fase 2)
/clube/conta/momentos   → depoimentos da cliente (Fase 3)
/clube/conta/clube      → conteúdo ATUAL migrado intacto (pontos/indicação/recompensas/extrato)
/clube/conta/perfil     → dados + senha (senha atual vira sub-rota daqui)
```

Layout compartilhado com tabs mobile-first (padrão `Tabs`/`Chip` da v5).
Aditivo → sem flag: rotas antigas continuam respondendo durante toda a
transição. `/clube/painel/[codigo]` (carteirinha sem login) fica como está.

### 3.5 Pontos novos: configuráveis, desligados por default

`business_settings`: `club_points_depoimento`, `club_points_foto`,
`club_points_reagendamento` — default **0** (desligado) até a Mi definir no
admin (R3, "sem valor hardcoded"). Crédito só na APROVAÇÃO, dedup
`depoimento:<id>` (1× por depoimento, mesmo re-aprovado após edição —
decisão anti-farm: edição NÃO gera novo crédito).

### 3.6 Notificações: dispatchEvent + jornadas (não n8n novo)

- `momento_pendente` → WhatsApp da Mi (link p/ fila) — dispatchEvent.
- `momento_aprovado` / `momento_nao_publicado` → WhatsApp da cliente (tom
  acolhedor, sem tom punitivo) — dispatchEvent, dedup por transição.
- D+2 pós-atendimento (convite a contar como foi) e D+N (cadência de
  reagendamento) → **jornadas existentes** (gatilho `pos_atendimento` /
  `manutencao`), respeitando `whatsappOptIn`, começando `ativo=false` até a
  Mi revisar a copy (padrão do CRM).

### 3.7 O que NÃO muda (guard-rails)

- Noiva/debutante: nunca agendáveis (todos os CTAs de repetição checam
  `bookableOnline`; falso → CTA WhatsApp).
- Ledger, resgate, escada de indicação, carteirinha: intactos.
- `Professional` é praticamente sempre a Mi (solo) — histórico diz "com a Mi",
  sem coluna nova.
- Foto de REFERÊNCIA do booking (`photoKey`, LGPD) não se mistura com foto de
  DEPOIMENTO — stores separados por semântica, mesmo dir físico `priv/`.

## 4. Riscos mapeados

| Risco | Mitigação |
|---|---|
| Quebrar a home (lê `testimonials`) | migration aditiva + `published` sincronizado até refactor |
| Crédito duplo de pontos | dedup_key por depoimento; crédito só na 1ª aprovação |
| Foto pendente vazar | tudo em `priv/` + rota com gate por status no banco |
| Upload malicioso | sharp decodifica (rejeita não-imagem) + mime allowlist + limite 8MB + rate-limit |
| n8n/Evolution fora do ar | dispatchEvent é fail-safe (try/catch, no-op sem env) — fluxo principal nunca trava |
| Regressão nas rotas atuais | rotas novas são aditivas; suíte (112 testes) verde antes de cada merge |

## 5. Ordem de execução (fases seguintes)

F1 migrations + shell → F2 histórico → F3 momentos+moderação → F4 vitrine
pública → F5 retenção → F6 auditoria+deploy. Cada fase: PR próprio, aceite
antes de avançar. Migrations (F1) exigem gate do Rodolfo (pg_dump antes).
