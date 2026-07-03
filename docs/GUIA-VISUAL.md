# Guia Visual — Portal Mi Ozorio

> Fonte de verdade do visual do portal (miozorio.com.br). Complementa a regra
> **R12** do `claude.md` e os tokens em `src/styles/tokens.css` /
> `tailwind.config.ts`. Atualizado em 2026-07-03 com propostas de melhoria
> inspiradas em referência de UI kit de app de beleza (booking mobile).

---

## 1. Identidade atual (não mudar sem aprovação da Mi)

### Paleta

| Token | Hex | Uso |
|---|---|---|
| `mi-branco` | `#FFFFFF` | cards elevados, superfícies |
| `mi-bege` | `#F5F0E8` | fundo principal |
| `mi-cinza` | `#E8E6E3` | divisores, superfícies secundárias |
| `mi-marrom` | `#8A7361` | acento, títulos, botões |
| `mi-marrom-escuro` | `#5C4A3D` | hover, texto forte |
| `mi-texto` | `#3D3733` | texto corrido |
| `mi-superficie-nav` | `#E8DFD2` | sidebar do /admin |
| `mi-superficie` | `#FBF9F5` | canvas do /admin |

### Tipografia e formas

- **Títulos:** Cormorant Garamond 500–600 (serifada elegante)
- **Corpo:** Jost 300–400
- **Raio padrão:** 14px (`rounded-mi`) · **Sombra:** `shadow-suave`
- **Vibe:** @anaveiga — clean, premium, acolhedor

### Antiexemplos (R12)

- ❌ Rosa choque / paleta vibrante de marketplace
- ❌ Ícones genéricos de e-commerce (carrinho, estoque)
- ❌ Jargão na UI ("slot", "booking", "lead") — R13

---

## 2. Melhorias inspiradas na referência (UI kit beleza)

A referência é um app mobile de agendamento de beleza (paleta rosa). **A paleta
NÃO deve ser copiada** — o valor está nos padrões de layout e microinterações,
traduzidos abaixo para os tokens da Mi. Tudo mobile-first 390px (R19).

### 2.1 Saudação personalizada no Clube — `/clube/painel`

Referência: header "Olá Issys" com avatar e ações rápidas.

- Topo do painel: **"Olá, {primeiro nome} 💛"** em Cormorant 600, sobre fundo bege.
- Abaixo, **chips de ação rápida** (pílulas `rounded-full`, uma ativa em
  `mi-marrom` com texto branco, demais em branco com borda `mi-cinza`):
  `Agendar · Minha agenda · Meus pontos · WhatsApp`.
- Substitui navegação "fria" por entrada acolhedora — voz da Mi (R7/R20).

### 2.2 Week-strip "Minha agenda" — `/clube/painel`

Referência: cartões de dia (27 TER · 28 QUA · 29 QUI) com o dia ativo em destaque.

- Faixa horizontal de cartões de data: dia do mês grande (Cormorant), dia da
  semana em Jost caps pequeno.
- Dia com atendimento: cartão `mi-marrom` com texto branco; demais em branco.
- Abaixo, card do compromisso: serviço + horário ("Maquiagem social · 15:00").
- Estado vazio com botão "+" suave (borda tracejada `mi-cinza`) → CTA "Agendar
  um horário" — nunca deixar área morta.

### 2.3 Tabs de categoria — `/agendar` e `/dia-a-dia`

Referência: tabs Makeup / Cabelo / Unhas / Sobrancelha com sublinhado ativo.

- Tabs: `Maquiagem · Penteado · Sobrancelha · Curso` (categorias reais do banco
  — R3, zero hardcode).
- Ativo: texto `mi-marrom-escuro` + sublinhado fino `mi-marrom`; inativo em
  `mi-texto` 60%.
- Scroll horizontal thumb-friendly em 390px.

### 2.4 Cards de serviço com foto + preço — `/agendar`, home

Referência: cards verticais com foto grande, nome, preço e CTA.

- Card branco `rounded-mi shadow-suave`: foto no topo (proporção 4:5), nome em
  Cormorant, preço em Jost, CTA "Agendar" em `mi-marrom`.
- Carrossel horizontal na home ("serviços mais pedidos" — dados reais).
- ⚠️ **Noiva e debutante NUNCA com botão de agendar** (R1/R14): card vitrine com
  CTA "Solicitar proposta no WhatsApp" e selo discreto "atendimento exclusivo".
- Depende do pacote de fotos (Anexo A item 3) — até lá, placeholder bege com
  monograma Mi.

### 2.5 Prova social — home e `/sobre`

Referência: lista "Top Profissionais" com avatar + estrelas.

- Adaptação (a Mi é solo, não há ranking de profissionais): seção **"O que as
  clientes dizem"** — cards com estrelas da avaliação Google, citação curta em
  Cormorant itálico e primeiro nome.
- Depende de depoimentos com autorização (Anexo A item 4); foto de cliente só
  com `photo_consent` (R6/R18).

### 2.6 Entrada do Clube mais quente — `/clube/entrar`

Referência: telas de login/cadastro com hero de foto no topo e formulário limpo.

- Hero com foto da Mi (quando houver pacote de fotos) com overlay bege
  translúcido + "Que bom te ver por aqui 💛" em Cormorant.
- Campos com cantos `rounded-mi`, check de validação em `mi-marrom` (nada de
  verde-limão da referência).
- Toggle "manter conectada" (feminino — voz da Mi).
- Login com Google: **proposta futura** (exige NextAuth provider novo) — anotar
  como F-candidato, não implementar sem OK.

### 2.7 Barra de resumo fixa no agendamento — `/agendar`

Referência: botão flutuante de total (R$ 329,95) sempre visível.

- Barra fixa inferior no fluxo de agendamento: serviço escolhido + valor +
  botão "Continuar" em `mi-marrom` — sempre ao alcance do polegar (R19).
- Não é carrinho: um agendamento por vez, sem metáfora de e-commerce.

### O que descartar da referência

- Paleta rosa/vermelha (antiexemplo explícito da R12).
- Badge de notificações push (não existe push no portal).
- Carrinho multi-itens e "favoritos" de produto — o portal vende horário e
  relação, não SKU.
- Login com Twitter/Facebook — fora do público da Mi.

---

## 3. Priorização sugerida

| # | Melhoria | Esforço | Dependência externa |
|---|---|---|---|
| 1 | Chips de ação rápida + saudação no Clube (2.1) | baixo | nenhuma |
| 2 | Week-strip Minha agenda (2.2) | médio | nenhuma |
| 3 | Barra de resumo fixa no /agendar (2.7) | baixo | nenhuma |
| 4 | Tabs de categoria (2.3) | baixo | nenhuma |
| 5 | Cards de serviço com foto (2.4) | médio | fotos (Anexo A.3) |
| 6 | Prova social (2.5) | médio | depoimentos (Anexo A.4) |
| 7 | Hero no /clube/entrar (2.6) | baixo | fotos (Anexo A.3) |

Itens 1–4 podem entrar já; 5–7 aguardam material da Mi.

> **Plano de execução completo:** `docs/PLANO-VISUAL-V5.md` (fases V0–V6,
> arquivos, DoD e sequência de deploy).
