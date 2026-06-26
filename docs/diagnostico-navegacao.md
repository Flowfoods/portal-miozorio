# Diagnóstico de Navegação — Portal Mi Ozorio (Fase 0)

> Inventário + grafo de navegação do estado **atual** (master `d820e98`). Sem
> refatoração — só a verdade do que existe. Legenda: ✅ OK · 🔴 quebrado ·
> 🟠 órfão · 🟡 duplicado/ambíguo · ⚠️ viola regra de negócio.

## Resumo executivo

O portal está **bem mais conectado do que o briefing presume**. O site público
tem **fonte única de navegação** (`navLinks.ts`, lida por Header + drawer),
**drawer mobile acessível já implementado** (o bug "nav some < 640px sem
hambúrguer" **já foi corrigido**), a **regra de ouro é respeitada** (noiva/
debutante só WhatsApp, nunca booking) e os **deep links funcionam**
(`/agendar?servico=` é pré-selecionado no wizard). Não há botões quebrados (404/
`#`/onClick vazio) no fluxo público.

Os problemas reais são **estruturais e de acabamento**, não "botões mortos":

1. **Os dois mundos não estão separados.** O `layout.tsx` raiz embrulha **todas**
   as rotas — inclusive `/admin/*` — com o **Header e Footer públicos**. As telas
   do admin renderizam o cabeçalho público (logo + nav + botão "Agendar") **por
   cima** da sidebar. É o item nº 1 a resolver (Fase 3 = route groups).
2. **Curso de automaquiagem sem porta de entrada** no site público.
3. Sem `not-found.tsx` global (404 cai no default sem marca/próximo passo).
4. Possível **sobreposição Resumo × Financeiro** no admin.
5. Sem breadcrumbs; footer enxuto; duas configs de nav (pública e admin) em vez
   de uma central.

---

## 1. Inventário de rotas

### Público (root layout: Header + Footer)
| Rota | Propósito | Entrada na nav? |
|---|---|---|
| `/` | Home (hero, serviços `#servicos`, especiais `#especiais`) | logo |
| `/agendar` | Fluxo de agendamento (wizard; aceita `?servico=`) | CTA "Agendar" |
| `/dia-a-dia` | Catálogo cabelo/sobrancelha → `/agendar?servico=` | nav |
| `/galeria` | Portfólio | nav |
| `/noivas` | Vitrine La Mariée → **WhatsApp** | nav |
| `/debutantes` | Vitrine debutante → **WhatsApp** | nav |
| `/clube` | Landing do Clube + entrar (`#participar`) | nav |
| `/clube/painel/[codigo]` | Carteirinha da membro | link pessoal (noindex) |
| `/indicar/[codigo]` (+`/obrigada`) | Captura de indicada | link pessoal (noindex) |
| `/sobre` | Sobre a Mi | nav |
| `/privacidade` | LGPD | footer |

### Admin (`/admin/*`, protegido por middleware NextAuth; AdminShell + sidebar)
| Rota | Propósito | Na sidebar? |
|---|---|---|
| `/admin` | Agenda (dia/semana) | ✅ "Agenda" |
| `/admin/resumo` | Resumo operacional (M14) | ✅ |
| `/admin/financeiro` (+ custos/receitas/categorias/recorrentes) | Financeiro | ✅ + FinanceSubnav |
| `/admin/crm` (+ funil/rfv/jornadas) | CRM | ✅ + hub linka subpáginas |
| `/admin/servicos` · `/fotos` · `/conteudo` · `/pacotes` · `/depoimentos` · `/bloqueios` · `/clientes` (+`/[id]`) · `/clube` · `/usuarias` · `/config` | Operação | ✅ |
| `/admin/login` · `/recuperar` · `/redefinir/[token]` | Auth (pré-login) | — (correto, fora da nav) |

**Órfãos de rota:** nenhum. Todas as telas admin estão na sidebar ou são
sub-páginas/detalhes linkados. Auth pages corretamente fora da nav.

---

## 2. Grafo de navegação (origem → destino → status)

### CTAs do site público
| Origem | Rótulo | Destino | Status |
|---|---|---|---|
| Header (logo) | Mi Ozorio | `/` | ✅ |
| Header / MobileNav | Agendar | `/agendar` | ✅ |
| Header/Drawer (navLinks) | Serviços | `/#servicos` (âncora existe, l.77) | ✅ |
| navLinks | Dia a dia / Galeria / Noivas / Debutantes / Clube / Sobre | rotas existentes | ✅ |
| Home | Agendar (x3) | `/agendar` | ✅ |
| Home | Ver especiais | `/#especiais` (âncora existe, l.193) | ✅ |
| Home | Noivas / Debutantes | `/noivas` `/debutantes` | ✅ |
| `/dia-a-dia` | Agendar [serviço] | `/agendar?servico=<code>` (wizard pré-seleciona) | ✅ |
| `/galeria` | Agendar | `/agendar` | ✅ |
| `/noivas` | Solicitar proposta | `wa.me/...proposta` | ✅ (regra OK) |
| `/debutantes` | Pacotes | `wa.me/...debutante` | ✅ (regra OK) |
| `/clube` | Participar | `#participar` (âncora existe, l.110) | ✅ |
| Footer | WhatsApp / Instagram / Privacidade / Área da Mi | wa.me / IG / `/privacidade` / `/admin` | ✅ |

### Admin
| Origem | Destino | Status |
|---|---|---|
| AdminSidebar (adminNavItems) | 14 seções do admin | ✅ |
| `/admin/crm` hub | `/admin/crm/{funil,rfv,jornadas}` | ✅ |
| FinanceSubnav | `/admin/financeiro/{,custos,receitas,categorias,recorrentes}` | ✅ |
| `/admin/clientes` | `/admin/clientes/[id]` | ✅ |
| Sidebar (rodapé) | Sair (signOut → `/admin/login`) | ✅ |

**Quebrados (🔴):** 0 · **Órfãos de botão (🟠):** 0 · **Violações da regra (⚠️):** 0.

---

## 3. Diagnóstico das 6 jornadas

| Jornada | Caminho | Trava? |
|---|---|---|
| **Social agenda** | Home → /agendar → serviço → data/hora → anamnese → confirmação | ✅ flui |
| **Noiva** | Home/nav → /noivas → "Solicitar proposta" → WhatsApp pré-preenchido | ✅ flui |
| **Debutante** | Home/nav → /debutantes → WhatsApp | ✅ flui (sem destaque ao responsável na copy) |
| **Aluna (curso)** | — | 🟠 **sem porta de entrada**: curso só aparece dentro da lista do /agendar; não há item de nav nem bloco na home |
| **Portfólio/WhatsApp** | nav → /galeria; footer/qualquer → WhatsApp | ✅ (sem CTA flutuante persistente de WhatsApp) |
| **Mi (admin)** | login → /admin (Agenda) → seções pela sidebar | ✅ funciona, **mas** com Header público sobreposto (ver nº 1) e sem um "Dashboard" de visão geral (a raiz é a Agenda) |

---

## 4. Navegação & responsividade

- **Fonte única (público):** ✅ `navLinks.ts` alimenta Header e MobileNav.
- **Fonte única (admin):** ✅ `adminNavItems.tsx` alimenta a AdminSidebar.
  → São **duas** fontes (uma por mundo); o briefing pede **uma** central
  (`lib/navigation.ts`). Funciona, mas não é a fonte única pedida.
- **Drawer mobile (público):** ✅ implementado e acessível (hambúrguer `sm:hidden`,
  focus trap, Esc, backdrop, scroll-lock, `aria-expanded/controls`, alvos ≥44px).
  **O bug do briefing já está corrigido.**
- **Sidebar admin:** ✅ expandida/trilho/gaveta + recolher com localStorage.
- **Vazamento de chrome:** 🔴 Header/Footer públicos aparecem no `/admin/*` e no
  `/agendar` (root layout incondicional).
- **Breadcrumbs:** 🟠 inexistentes (agendar e admin).
- **not-found.tsx global:** 🔴 inexistente.

---

## 5. TOP 10 problemas de conexão (por impacto)

1. **🔴 Dois mundos não separados** — Header/Footer públicos vazam para `/admin/*`
   (e `/agendar`). Telas do admin mostram nav pública + botão "Agendar" sobre a
   sidebar. **Correção:** route groups `(public)`/`(admin)` com layouts próprios
   (Fase 3). Maior impacto: profissionaliza o painel e o fluxo de booking.
2. **🟠 Curso de automaquiagem sem porta de entrada** — jornada "Aluna" não começa
   em lugar nenhum no site público. Precisa de item de nav e/ou bloco na home com
   CTA "Inscrever-se" (entra no /agendar com o serviço curso pré-selecionado).
3. **🔴 Sem `not-found.tsx` global** — 404 cai no default do Next, sem marca nem
   próximo passo (beco sem saída). Criar 404 da Mi com CTA pra home/WhatsApp.
4. **🟡 Resumo × Financeiro (possível duplicação)** — `/admin/resumo` (M14) e
   `/admin/financeiro` podem se sobrepor. Decidir o papel de cada um (ou
   consolidar) pra não confundir a Mi.
5. **🟠 `/admin` é a Agenda, não um Dashboard** — falta uma visão geral do dia com
   atalhos (o briefing pede Dashboard como raiz do admin).
6. **🟠 Sem breadcrumbs** no fluxo de agendamento e no admin — o usuário nem sempre
   sabe "onde estou / como volto" (especialmente no wizard e em telas profundas).
7. **🟡 Duas fontes de navegação** (`navLinks.ts` + `adminNavItems.tsx`) em vez de
   uma config central tipada (`lib/navigation.ts`) como o briefing pede.
8. **🟠 Footer enxuto** — só contato/IG/privacidade/admin; não oferece os caminhos
   principais (noivas, galeria, dia a dia, clube, sobre) como rodapé-sitemap.
9. **🟠 Sem CTA flutuante de WhatsApp** persistente (discreto) — conversão de
   visitante depende de rolar até o footer ou achar a página certa.
10. **🟡 Estados vazios sem próximo passo** — confirmar se agenda/clientes/
    financeiro vazios oferecem CTA (ex.: "nenhum lançamento — comece anexando um
    custo" já existe no financeiro; padronizar nos demais).

---

## 6. Conclusão da Fase 0

Não há "botões mortos" no público — o trabalho é de **arquitetura** (separar os
dois mundos, dar entrada ao curso, 404 decente, breadcrumbs, dashboard admin) e
de **consolidação** (uma config de nav, papel de Resumo×Financeiro). Nada disso
exige quebrar URLs existentes.

**Próximo passo:** aprovar este diagnóstico → Fase 1 (sitemap + matriz de botões).
