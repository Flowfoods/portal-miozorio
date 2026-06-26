# Mapa de Navegação — Portal Mi Ozorio (Fase 1)

> Arquitetura-alvo: sitemap + **matriz de botões** (o contrato). A implementação
> (Fases 2–6) tem que bater 100% com esta matriz. Regra de ouro: noiva/debutante
> = vitrine + WhatsApp, **nunca** booking.

## Sitemap (dois mundos separados por route group)

```
(site) — layout público com Header + Footer
├── /                      Início (hero + 3 jornadas: Agendar · Especiais · Clube)
│   ├── #servicos          Maquiagem social · Penteado · Sobrancelha  → [Agendar]
│   ├── #especiais         Noiva · Debutante                          → [Solicitar proposta]
│   └── #curso             Curso de automaquiagem                     → [Inscrever-se]
├── /agendar               Wizard (serviço → data/hora → anamnese → confirmação)
├── /dia-a-dia             Catálogo cabelo/sobrancelha → [Agendar ?servico=]
├── /galeria               Portfólio → [Agendar]
├── /noivas                Vitrine La Mariée → [Solicitar proposta WhatsApp]
├── /debutantes            Vitrine debutante → [Solicitar proposta WhatsApp]
├── /clube                 Clube (como funciona + participar)
├── /sobre                 Sobre a Mi
├── /privacidade           LGPD
└── (links pessoais, noindex) /clube/painel/[codigo] · /indicar/[codigo]

(admin) — layout protegido com Sidebar (AdminShell); SEM chrome público
├── /admin                 Agenda (dia/semana)  ← raiz operacional
├── /admin/resumo          Resumo do dia/semana (operação)
├── /admin/financeiro      Financeiro (DRE/custos/receitas)   ← papel ≠ Resumo
├── /admin/crm             CRM (RFV/funil/jornadas)
├── /admin/clientes        Clientes → /[id] (ficha 360)
├── /admin/servicos · /fotos · /conteudo · /pacotes · /depoimentos
├── /admin/bloqueios · /clube · /usuarias · /config
└── (auth) /admin/login · /recuperar · /redefinir/[token]

raiz (sem grupo): /api/* · /media/* · robots · sitemap · not-found (404 da marca)
```

## Matriz de botões — público

| Tela | Rótulo | Tipo | Destino | Próximo passo |
|---|---|---|---|---|
| Header | Mi Ozorio (logo) | voltar | `/` | escolher jornada |
| Header/Drawer | Agendar | primary | `/agendar` | escolher serviço |
| Header/Drawer | Serviços/Dia a dia/Galeria/Noivas/Debutantes/Clube/Sobre | secondary | rotas | conteúdo da seção |
| Home #servicos | Agendar [serviço] | primary | `/agendar?servico=<code>` | data/hora |
| Home #especiais | Solicitar proposta (noiva/deb.) | whatsapp | `wa.me/...` | conversa com a Mi |
| **Home #curso** (novo) | Inscrever-se | primary | `/agendar?servico=curso-automaquiagem` | escolher data |
| /dia-a-dia | Agendar [serviço] | primary | `/agendar?servico=<code>` | data/hora |
| /galeria | Agendar | primary | `/agendar` | escolher serviço |
| /noivas | Solicitar proposta | whatsapp | `wa.me/...proposta` | conversa |
| /debutantes | Solicitar proposta | whatsapp | `wa.me/...debutante` | conversa |
| /clube | Participar | primary | `#participar` (form) | entrar no clube |
| /agendar (fim) | Confirmação + próximos passos | secondary | Instagram / Como chegar / WhatsApp | — (sem beco) |
| Flutuante (todas) | WhatsApp | whatsapp | `wa.me/...` | conversa |
| Footer | Caminhos (Agendar/Noivas/Debutantes/Dia a dia/Galeria/Clube/Sobre) + Contato + Área da Mi | secondary | rotas | — |
| 404 | Voltar ao início / Falar no WhatsApp | primary/whatsapp | `/` · `wa.me` | — |

## Matriz de botões — admin (sidebar = adminNavItems; já coerente)

| Origem | Rótulo | Destino | Próximo passo |
|---|---|---|---|
| Sidebar | Agenda/Resumo/Financeiro/CRM/Clientes/Serviços/… | `/admin/...` | operar a seção |
| /admin/clientes | nome da cliente | `/admin/clientes/[id]` | ficha 360 |
| /admin/crm | Funil/RFV/Jornadas | `/admin/crm/*` | gerir |
| /admin/financeiro | Custos/Receitas/Categorias/Recorrentes | `/admin/financeiro/*` | lançar |
| Sidebar (rodapé) | Sair | signOut → `/admin/login` | — |

## Decisões de arquitetura
- **Route groups** `(site)` e `(admin)`: resolvem o vazamento do Header/Footer no
  admin. URLs **não mudam** (grupos são transparentes) → zero redirect necessário.
- **Curso** ganha entrada (nav/home/footer) via deep link `?servico=curso-automaquiagem`
  (reusa o wizard; nada de fluxo novo).
- **Resumo × Financeiro**: papéis distintos (operação × dinheiro) — mantidos.
- **Uma config por mundo** hoje (`navLinks.ts` + `adminNavItems.tsx`); aceitável.
- **404 da marca** + **CTA flutuante de WhatsApp** + **footer-sitemap**.
