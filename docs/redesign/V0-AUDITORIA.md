# V0 — Auditoria Visual (16/08/2026)

Redesign visual do admin — referência de composição "Ultraleads" (hierarquia,
não paleta). Screenshots do estado atual em `debug/visual-antes/` (15 telas ×
2 viewports, 390×844 e 1440×900, dados de dev realistas no banco local).

## V0.1 Inventário

| Item | Estado |
|---|---|
| Biblioteca de gráficos | **Nenhuma** — SVG puro feito à mão em `src/components/admin/finance/Charts.tsx` (barras agrupadas + donut). Zero-dep, SSR-friendly. **Decisão: manter a abordagem SVG e evoluí-la como sistema** (V2) em vez de adicionar recharts — o bundle não cresce e o requisito V6.2 (`dynamic()`/sem SSR para lib pesada) fica satisfeito por construção. |
| Tokens Tailwind | `mi.branco/bege/cinza/marrom/marrom-escuro/marrom-suave/ok/texto` + superfícies do admin (`superficie-nav/superficie/superficie-elevada` via CSS vars em `src/styles/tokens.css`). **Não existe escala** — só 3 tons de marrom. |
| Fontes | Cormorant Garamond (títulos) + Jost (corpo) via next/font. OK, mantidas. |
| Raio/sombra | `rounded-mi` 14px único; `shadow-suave` (preto 6%) e `shadow-nav-col`. Sombra é **preta**, não marrom. |
| Cores fora do sistema | **109** usos de paleta default do Tailwind (`emerald-*`, `red-*`, `amber-*`, `green-*`…) e **59** hex soltos em componentes (fora tokens.css). Maiores focos: Financeiro (variação/DRE em emerald/red), alertas em amber, pills de status da Agenda, `Charts.tsx` (`#7C9A6B`, `#B5705A`, `#5C8A4E`, `#B5485A`, eixo `#C9BFB2`). |
| Cores de categoria financeira | Vêm do banco (`financial_categories.color`, seed on-brand, mas há tons fora da família — azul-aço apareceu no donut de despesas). |

## V0.3 Diagnóstico por tela (priorizado)

### P1 — Resumo (`/admin/resumo`)
- 8 cards **idênticos** brancos: nenhuma hierarquia; o faturamento (métrica nº1) tem o mesmo peso visual de "Cancelamentos".
- Número em Cormorant `text-2xl` (~24px): elegante porém **fraco** — sem contraste com o rótulo; dígitos serifados dificultam leitura rápida de valor.
- **Zero gráficos** (a tela mais "dashboard" não tem nenhum); só lista de serviços.
- Sem comparação com período anterior (nenhum delta badge).
- Navegação de mês por botões ←/→ minúsculos; "Ver por período" é link sublinhado tímido (vs. controle segmentado da referência).
- Metade inferior da tela vazia no desktop.

### P1 — Financeiro (`/admin/financeiro`)
- Único com gráficos, mas: variações e DRE em `emerald-700`/`red-700` (fora do token, saturados); alerta em `amber-50/900`; paleta dos SVG hardcoded; fatia azul-aço no donut (cor do banco).
- Barras sem topo arredondado, sem estados (carregando/vazio/erro), sem tooltip, eixo/labels desalinhados com a tipografia do sistema.
- 8 KPIs uniformes de novo — "Resultado do período" deveria ser o herói.
- Faixa "Entrou/Saiu/Resultado" densa, com ▲▼ colados em texto pequeno.

### P2 — Agenda (`/admin`)
- Pill "Confirmado" verde-menta default (fora do token); status comunicado **só por cor**.
- Faixa de 4 KPIs idênticos; "Resultado do mês" vermelho default.
- Cartões de atendimento OK de estrutura, mas ações repetidas 4× (Concluir/Não veio/Cancelar/Remarcar) pesam a tela.

### P2 — Clientes
- Tabela pura sem badges RFV (a segmentação existe no banco e não aparece); coluna "Sinal exigido?" com "não" em texto solto.
- Em 390px a tabela espreme — precisa virar cards (V4).

### P3 — Serviços, Campanhas, Config, demais
- Formulários razoáveis, mas sem agrupamento visual; checkboxes soltos onde caberia controle segmentado; nenhum EmptyState ilustrado (o `EstadoVazio` existe e é bom, mas é pouco usado).

### O que já está bom (não mexer além do polish)
- Sidebar 3 estados (expandida/trilho/gaveta) com focus trap e reduced-motion — **manter**.
- Sistema de superfícies do admin (nav/canvas/card) — manter e estender.
- EstadoVazio, Botao, Chip — base aproveitável.

## Plano de ataque
V1 tokens+componentes → V2 gráficos → V3 Resumo → V4 propagação → V5 mobile → V6 QA → V7 deploy (gate).
