# V7 — QA de acessibilidade do SITE PÚBLICO

> O V6 (`docs/redesign/V6-QA.md`, 17/08/2026) varreu **16 rotas do `/admin`** e
> zerou o contraste lá. O site público — as 22 rotas de `src/app/(site)/` — nunca
> passou pela mesma varredura. Este documento fecha essa lacuna.

## Por que existia a lacuna

O V6 nasceu do redesign do painel (`docs/redesign/V0-AUDITORIA.md`: "Redesign
visual do admin"). O escopo era o admin, e o relatório é explícito sobre isso.
O resultado é que **os mesmos dois defeitos foram corrigidos de um lado só**:

| | `/admin/login` (V6 corrigiu) | `/clube/entrar` (ficou) |
|---|---|---|
| divisor "ou" | `text-mi-texto/80` → **5,81:1** | `text-mi-texto/40` → **2,13:1** |
| "Esqueci a senha" | `text-mi-marrom-700` → **5,94:1** | `text-mi-marrom` → **3,93:1** |

Os valores 2,13:1 e 3,93:1 são exatamente os que o V6 registra ter medido e
corrigido no admin — a tela gêmea do Clube seguiu com eles.

## A regra que estava sendo violada

`tailwind.config.ts:23` já dizia, por escrito:

> `#8A7361` puro sobre branco ≈ 4,4:1 — passa só em texto grande;
> texto < 18px usa 700 ou mais escuro (obrigatório, AA).

Medição da tinta da marca como texto pequeno (composição de camadas alfa, não
"a olho"):

| Tinta | branco | bege `#F5F0E8` | cinza `#E8E6E3` | `superficie-nav` |
|---|---|---|---|---|
| `mi-marrom` (500) | 4,46 | 3,93 | 3,58 | 3,38 |
| `mi-marrom-700` | 6,74 | **5,94** | **5,41** | **5,11** |

Agrava: `globals.css` define `body { font-weight: 300 }` (Jost Light) — o texto
é mais fino do que a razão sozinha sugere.

## O que foi corrigido (25 pontos, 15 arquivos)

**Tinta 500 → 700 em texto pequeno (18 pontos)**
- Home: os 3 subtítulos de seção (`page.tsx:93,142,222`) — 16px a 3,93:1.
- `HistoriasClientes.tsx:26` — **pior caso, 3,38:1** (tinta 500 sobre `#E8DFD2`).
- `/agendar`: labels dos campos, controle "No estúdio/Em domicílio" (3,58:1
  sobre cinza) e o estado `hover` do "voltar" — um hover não pode derrubar o
  contraste abaixo de AA.
- `/clube`: link "Agende seu horário", link "Entrar", "Esqueci minha senha",
  pontos negativos do extrato.
- Botões secundários de `/clube`, `/agendar/error` e `/indicar/.../obrigada`.
- `/dia-a-dia`: "Valor a combinar" — é preço, precisa ser legível.
- `/noivas`: numeral da jornada (20px **não** é "texto grande" em WCAG: o piso é
  24px, ou 18,66px em negrito) + marcadores de lista das duas vitrines.

**Outros tons (3 pontos)**
- `LoginForm.tsx:53` — divisor "ou": `text-mi-texto/40` → `/80` (2,13 → 5,81).
- `AgendarWizard.tsx:741` — rótulo de passo não concluído: `/70` → sem alfa
  (3,56 → 7,40). Passo futuro é informação, não estado desabilitado.
- `PasswordField.tsx:97` — ícone mostrar/ocultar senha a **2,62:1**, sendo o
  único indicador visual do botão (WCAG 1.4.11 exige 3:1). **Componente
  compartilhado**: a correção também alcança `/admin/login`, `/admin/redefinir`
  e `AdminContaForm` — o V6 passou por ele sem pegar.

**`vh` → `dvh` (4 pontos)**
O V6 corrigiu isso no admin ("`dvh` no lugar de `vh` — armadilha do BUG C") e
não no público: `GaleriaLightbox.tsx:69,77`, `AgendarWizard.tsx:874`
(confirmação) e `agendar/error.tsx:26`. Em navegador mobile `vh` ignora a barra
do navegador — `max-h-[76vh]` deixava a foto do lightbox maior que a área visível.

## O que foi deliberadamente NÃO alterado

Cada um foi medido e classificado, não presumido:

- **Estados `disabled:`** (`Chip.tsx:26`, `WeekStrip.tsx:28`, `RecuperarForm.tsx:122`)
  — WCAG 1.4.3 isenta componente de interface inativo. `WeekStrip` renderiza
  `<button disabled>` de verdade nos dias sem vaga.
- **Decorativo `aria-hidden`** — monogramas com opacidade (`/25`, `/30`, `/40`),
  chevron do MobileNav, ícones de WhatsApp/Instagram ao lado do texto que já diz
  a mesma coisa.
- **Texto grande legítimo** — preços em `text-4xl`, `/clube` em `text-2xl` (24px
  = 18pt, piso do "large text"), itens do MobileNav em `text-[25px]`. A 3,93:1
  passam no piso de 3,0.
- **`Estrelas.tsx` e `MomentoForm.tsx`** — a nota é exposta por `role="img"` +
  `aria-label` e por `aria-pressed`; os SVG são `aria-hidden`. A estrela cheia
  está a 3,93:1, acima do piso de 3:1 de 1.4.11.

## Regressão

`npm test` **246/246 verdes** · `tsc --noEmit` limpo · `next lint` sem avisos ·
`next build` exit 0. Mudança puramente de apresentação: nenhuma rota, query,
schema, regra de agendamento ou texto de banco foi tocado — só o valor de classes
Tailwind de cor e 4 unidades `vh`→`dvh`.

**Prettier:** `--check` acusa 13 arquivos, mas **já acusava no master antes desta
mudança** (verificado com `git stash`). O `prettier-plugin-tailwindcss` quer
reordenar as classes de arquivos inteiros; rodar `--write` produziria um diff
enorme e sem relação com a correção. O pre-commit do repo roda lint+typecheck,
não prettier. Fica como está — dívida de formatação pré-existente, anotada aqui.

## Sugestão de próximo passo

O V6 validou o admin com varredura programática via Playwright (composição de
camadas, nós de texto diretos). Valeria rodar o mesmo instrumento sobre as 22
rotas públicas em ambiente com banco, para pegar o que só aparece renderizado —
texto sobre foto, estados de erro de formulário e o carrossel da home.
