# Plano Visual v5 — Portal Mi Ozorio

> Plano de execução para atualizar todo o visual do portal (miozorio.com.br),
> baseado no `docs/GUIA-VISUAL.md` (referência UI kit beleza, adaptada à
> identidade R12). Criado em 2026-07-03. Convenções: branch
> `feat/v5-vN-nome-curto` → PR → merge master → deploy (gate: OK do Rodolfo).

## Princípios inegociáveis

- **R11**: nada quebra o que está no ar. Visual-only — **zero mudança de schema**,
  zero mudança no motor de agendamento. Suíte verde antes de qualquer merge.
- **R12**: paleta bege/marrom, Cormorant+Jost. O rosa da referência NÃO entra.
- **R1/R14**: noiva/debutante seguem sem botão de agendar (CTA WhatsApp).
- **R3**: textos/preços continuam vindo de `site_content`/`services` — o plano
  muda apresentação, nunca conteúdo hardcoded.
- **R19**: toda tela validada em 390px antes do DoD (a Mi opera pelo celular).
- **R13**: zero jargão na UI ("horário", nunca "slot").

## Visão geral das fases

| Fase | Escopo | Esforço | Depende de |
|---|---|---|---|
| V0 | Fundação: tokens + componentes UI compartilhados | M | — |
| V1 | Header, MobileNav, Footer | S | V0 |
| V2 | Home | M | V0 |
| V3 | /agendar (wizard) | L | V0 |
| V4 | Clube (entrar, painel, conta, indicar) | M | V0 |
| V5 | Vitrines: noivas, debutantes, dia-a-dia, galeria, sobre | M | V0, fotos* |
| V6 | QA final: performance, acessibilidade, smoke 390px | S | V1–V5 |

*Fotos e depoimentos (Anexo A itens 3–4 do claude.md) destravam o potencial
máximo de V2/V5, mas nenhuma fase bloqueia neles — tudo tem fallback
`MonogramPlaceholder`.

---

## V0 — Fundação do design system (`feat/v5-v0-fundacao`)

**Objetivo:** parar de repetir classes Tailwind longas em cada página e criar a
base para os padrões novos do guia. Hoje o botão primário aparece colado inline
em ≥3 lugares de `src/app/(site)/page.tsx`.

**Entregas:**

1. `src/styles/tokens.css` — acrescentar (sem remover nada):
   - `--mi-marrom-suave: #A89380` (estados desabilitados/bordas de destaque)
   - `--mi-ok: #7A8B6F` (confirmação on-brand, verde-oliva discreto — nunca verde-limão)
   - `--transicao: 150ms ease` e `--radius-pill: 999px`
2. Novos componentes em `src/components/ui/` (client-safe, sem lógica de negócio):
   - `Botao.tsx` — variantes `primario | secundario | whatsapp` (mín. 52px de altura)
   - `Chip.tsx` — pílula de ação rápida (ativa: marrom/texto branco; inativa: branco/borda cinza)
   - `Tabs.tsx` — tabs com sublinhado fino marrom, scroll horizontal
   - `CardServico.tsx` — foto 4:5 + nome (Cormorant) + preço (Jost) + CTA; prop
     `vitrine` troca "Agendar" por "Solicitar proposta no WhatsApp" (R1/R14)
   - `WeekStrip.tsx` — faixa de cartões de data (dia ativo em marrom)
   - `Estrelas.tsx` — avaliação 1–5 em marrom
   - `EstadoVazio.tsx` — borda tracejada cinza + CTA
3. Microinterações globais em `globals.css`: `:focus-visible` com anel marrom,
   `prefers-reduced-motion` respeitado, transição suave padrão em links/botões.

**DoD:** typecheck+lint verdes; nenhum uso novo ainda (componentes entram nas
fases seguintes); Storybook NÃO entra (overhead desnecessário) — validação
visual por página de teste temporária removida antes do merge.

---

## V1 — Navegação e rodapé (`feat/v5-v1-navegacao`)

**Arquivos:** `src/components/site/Header.tsx` (44L), `MobileNav.tsx` (167L),
`Footer.tsx` (57L), `FloatingWhatsApp.tsx`.

**Entregas:**

1. Header sticky com fundo `mi-bege/90` + `backdrop-blur` ao rolar; logo
   monograma centralizado no mobile.
2. Link ativo com sublinhado fino marrom (padrão das tabs do guia).
3. MobileNav: transição de entrada suave (slide + fade), itens maiores
   (thumb-friendly), CTA "Agendar" em destaque no fim da lista.
4. Footer: reorganizar em 3 blocos (marca/contato/legal), ícones sociais em
   marrom, WhatsApp com `wa.me` correto.
5. FloatingWhatsApp: não sobrepor a futura barra de resumo do /agendar
   (esconder na rota /agendar — a barra V3 assume o CTA).

**DoD:** navegação testada em 390px em todas as rotas; sem CLS ao fixar header.

---

## V2 — Home (`feat/v5-v2-home`)

**Arquivo:** `src/app/(site)/page.tsx` (255L). Conteúdo segue 100% de
`site_content`/`media_assets`/`testimonials` (R3) — muda só a apresentação.

**Entregas:**

1. **Hero:** foto com moldura orgânica (cantos asimétricos `rounded-mi` maiores
   no topo), eyebrow com linha decorativa, CTAs usando `Botao`.
2. **Serviços:** grid atual → **carrossel horizontal** de `CardServico` no
   mobile (grid mantido em desktop). Fotos por serviço quando existirem
   (`media_assets` por serviço é evolução futura — usar placeholder até lá).
3. **Depoimentos:** cards com `Estrelas` + citação em Cormorant itálico +
   primeiro nome; carrossel no mobile.
4. **Especiais (noivas/debutantes):** cards vitrine com foto de fundo + overlay
   bege translúcido + selo "atendimento exclusivo"; CTA WhatsApp explícito.
5. **CTA final:** faixa em `mi-superficie-nav` (#E8DFD2) para fechar a página
   com contraste quente.

**DoD:** Lighthouse mobile ≥ 90 em performance; LCP = foto hero com `priority`;
sem regressão nos textos vindos do banco (conferir chaves `home.*`).

---

## V3 — Fluxo de agendamento (`feat/v5-v3-agendar`)

**Arquivo:** `src/components/agendar/AgendarWizard.tsx` (634L) +
`src/app/(site)/agendar/page.tsx`. **Maior fase — não tocar na lógica de
disponibilidade/booking, só na camada visual do wizard.**

**Entregas:**

1. **Tabs de categoria** (`Tabs`): Maquiagem · Penteado · Sobrancelha · Curso —
   categorias vindas do banco (R3).
2. **Passo serviço:** lista atual → `CardServico` em grid 2 col (390px) com
   preço visível.
3. **Passo data:** calendário atual → `WeekStrip` com navegação por semana
   (setas), dias sem vaga esmaecidos; feedback de carregamento com skeleton
   bege (nada de spinner genérico).
4. **Passo horário:** chips de horário (`Chip`) em grid, selecionado em marrom.
5. **Barra de resumo fixa inferior** (novo `BarraResumo.tsx` em
   `src/components/agendar/`): serviço + data/hora + valor + botão "Continuar";
   aparece a partir da seleção de serviço; `safe-area-inset-bottom` respeitado.
6. **Indicador de progresso:** 4 pontos discretos no topo (serviço → data →
   horário → seus dados), sem números nem jargão.
7. **Confirmação:** tela de sucesso com resumo em card, ícone check em
   `--mi-ok`, CTA "Adicionar ao calendário" (link .ics já existente? verificar;
   se não existir, fica fora — sem escopo novo de backend).

**DoD:** os 13 testes do motor intactos e verdes; fluxo completo testado em
prod pós-deploy (sem banco local — R do ambiente); anamnese (alergia/ocasião/
referência) intocada; 390px validado em cada passo.

---

## V4 — Clube (`feat/v5-v4-clube`)

**Arquivos:** `src/app/(site)/clube/{page,entrar,conta,painel/[codigo]}.tsx`,
`src/components/clube/{LoginForm,JoinForm,ClubFields,SenhaForm,IndicarForm}.tsx`.

**Entregas:**

1. **/clube/entrar:** hero com foto da Mi + overlay bege + "Que bom te ver por
   aqui 💛" (Cormorant); formulário em card branco elevado; toggle "manter
   conectada" se a sessão já suportar (verificar NextAuth — se não suportar,
   não inventar backend).
2. **/clube/painel/[codigo]:** topo "Olá, {primeiro nome} 💛" + chips de ação
   rápida (`Agendar · Minha agenda · Meus pontos · WhatsApp`); pontos em card
   destaque com progresso visual até a próxima recompensa; **"Minha agenda"**
   com `WeekStrip` + card do próximo atendimento + `EstadoVazio` com CTA
   quando não houver nada.
3. **/clube/conta:** formulários padronizados com os inputs de V0; página de
   senha idem.
4. **/indicar/[codigo]:** card de convite com o monograma + copy acolhedora;
   tela "obrigada" com confirmação em `--mi-ok`.

**DoD:** LGPD intacta (alergia só autenticado — R6/R18); fluxo login → painel →
indicar testado em 390px; sem mudança em `actions.ts` além de dados já expostos.

---

## V5 — Páginas vitrine (`feat/v5-v5-vitrines`)

**Arquivos:** `noivas/page.tsx`, `debutantes/page.tsx`, `dia-a-dia/page.tsx`,
`galeria/page.tsx`, `sobre/page.tsx`, `privacidade/page.tsx`.

**Entregas:**

1. **Noivas (La Mariée):** página com ritmo editorial — hero full-bleed,
   seções alternadas foto/texto, timeline da jornada (reunião → prévia → dia),
   pacotes em cards SEM preço agendável, CTA WhatsApp fixo. Selo "um casamento
   por dia — exclusividade".
2. **Debutantes:** mesmo esqueleto com copy própria; lembrar responsável legal
   na comunicação (R6).
3. **Dia a dia:** grade de serviços com `CardServico`; serviços `pending_price`
   exibem "consultar" (nunca inventar preço).
4. **Galeria:** grid masonry 2-col mobile / 3-col desktop com lightbox leve
   (sem lib pesada — dialog nativo + CSS); filtro por categoria com `Chip`.
5. **Sobre:** foto + credenciais (12 anos, HD, visagismo…) em lista elegante;
   selo cruelty-free em destaque discreto.

**DoD:** todas com fallback `MonogramPlaceholder` até chegarem as fotos; JSON-LD
existente preservado; 390px validado.

---

## V6 — QA final e polimento (`feat/v5-v6-qa`)

1. **Performance:** Lighthouse mobile em todas as rotas públicas (meta ≥90);
   `next/image` com `sizes` corretos; fontes sem CLS (já via `next/font`).
2. **Acessibilidade:** contraste AA (atenção: marrom #8A7361 sobre bege #F5F0E8
   ≈ 3.4:1 — usar `mi-marrom-escuro` para texto pequeno sobre bege);
   `focus-visible` em tudo; `aria-label` nos ícones; formulários com labels.
3. **Smoke 390px:** roteiro completo — home → agendar (4 passos) → confirmar;
   entrar no clube → painel → indicar; todas as vitrines.
4. **Regressão:** `npm test` (13 testes) + typecheck + lint; conferir /admin
   não afetado (superfícies do admin não mudam nesta v5).

---

## Sequência de execução e deploy

```
V0 ──► V1 ──► V2 ──► V3 ──► V4 ──► V5 ──► V6
        └──── deploy por fase (gate: OK Rodolfo) ────┘
```

- 1 PR por fase, commits pequenos pt-BR (`V3.2: agendar - barra de resumo`).
- Deploy incremental por fase (Dokploy API), health check + smoke 390px em
  prod após cada um — nunca acumular 6 fases num deploy só (R11).
- Validação com a Mi: mandar print mobile após V2 (home) e V3 (agendar) antes
  de seguir — são as telas que ela mais usa para vender.

## Fora de escopo desta v5

- Visual do `/admin` (sistema de superfícies já entregue; revisar numa v6).
- Login com Google no Clube (F-candidato — precisa de decisão de produto).
- Gateway PIX, e-mail transacional (F7 — outro trilho).
- Qualquer mudança de schema, motor, preços ou políticas.

## Riscos e mitigação

| Risco | Mitigação |
|---|---|
| Sem banco local, /agendar degrada no dev | validar UI com estados mockados no wizard; teste funcional em prod pós-deploy |
| Refatorar AgendarWizard (634L) introduzir bug de fluxo | extrair apenas camada visual; lógica de fetch/estado intocada; testes do motor como rede |
| Contraste do marrom sobre bege reprovar AA | regra fixa: texto <18px sobre bege usa `mi-marrom-escuro` |
| Fotos não chegarem | placeholder monograma já é o fallback em tudo; V2/V5 não bloqueiam |
| CLS com header sticky | reservar altura fixa do header; testar em Lighthouse |
