# V6 — QA visual, acessibilidade e performance (17/08/2026)

## Contraste AA (validado programaticamente, não a olho)
Varredura própria (Playwright + composição de camadas alfa, nós de texto
diretos, teto 3:1 para decorativo `aria-hidden`): **16 rotas × 2 viewports →
0 violações**. O medidor pegou e nós corrigimos:
- `text-mi-marrom-500` como tinta de legenda: **4,46:1 — reprovava por 0,04**
  (StatCard, DeltaBadge, PainelHoje, BarrasHChart, design system) → 700.
- Pré-existentes: login ("ou" a 2,13:1, "Esqueci a senha" e botão de biometria
  a 3,93:1) e os toggles Dia/Semana e Caixa/Competência (3,58:1) → tintas 700/800.

## Cores fora do token
- Paleta default do Tailwind: **0 ocorrências** (eram 162; codemod semântico
  emerald→sucesso, red→erro, amber→alerta, azuis→marrom, cinzas→família).
- Hex solto em componente: restam apenas o default do color-picker de
  categorias (valor do próprio token), a rota `/api/og` (estilo inline
  obrigatório do renderer de OG, valores dos tokens) e comentários.

## Estados de gráfico
Carregando (skeleton com formato) / vazio (convite) / erro (recarregar)
implementados no sistema (V2) e aplicados em Resumo e Financeiro. Visíveis em
`/admin/design-system`.

## Mobile
- Tooltip por toque (pointerdown) nos gráficos interativos; coluna inteira da
  barra é área de toque.
- `dvh` no lugar de `vh` (AdminShell, sidebar, /agendar) — armadilha do BUG C.
- Rótulos abreviados (Seg/Ter…), scroll horizontal com `min-width` por
  categoria, alvos ≥44px nos controles.

## Performance
- **Nenhuma dependência nova** — recharts foi deliberadamente evitado; o
  sistema de gráficos é SVG/CSS puro, SSR-friendly. O requisito
  "dynamic()/sem SSR para lib pesada" fica satisfeito por não existir lib.
- First Load JS compartilhado: **87,3 kB** (inalterado). Rotas admin: 96–105 kB;
  `/admin/resumo` +~3 kB (componentes de gráfico client).
- Sem layout shift: gráficos com altura reservada (`height`/`minHeight` fixos).
- **Lighthouse mobile (preset padrão 4G, produção local)** em `/admin/login`:
  Performance **99** · Acessibilidade **100** · Best Practices **100** ·
  SEO 63 (correto: painel interno com noindex).

## Regressão funcional
- `npm test`: **236/236 verdes**. Build de produção verde. Nenhuma rota,
  query de escrita, schema ou regra de agendamento alterada — as únicas
  adições de leitura são `getResumoExtras` (SELECTs) e o campo `rfvSegmento`
  já existente exibido na lista de clientes.
- Noiva/Debutante: seguem `bookableOnline=false` (lógica intocada) e ganharam
  o selo "Sob consulta · WhatsApp" na tela de Serviços.

## Comparação visual
`debug/visual-antes/` × `debug/visual-depois/` (15 telas × 2 viewports cada) —
abrir `debug/comparacao.html` para ver lado a lado.
