# Changelog — Portal Mi Ozorio

Registro do que foi entregue por frente. Produção: **https://miozorio.com.br**.

> Observação: o super-prompt citava o domínio `mileneozorio.com`, que **não existe**.
> O portal real é `miozorio.com.br` (confirmado pelo Rodolfo).

## Sessão 2026-06-16/17 — v4.1 + super-prompt

### Clube de Fidelidade por PONTOS (Anexo 1) ✅ no ar
- Ganho de pontos por atendimento concluído (configurável por serviço) e por
  indicação concretizada (1º atendimento da indicada).
- Resgate por catálogo de recompensas (prêmio/serviço, custo em pontos).
- Saldo + extrato auditável por cliente.
- Antifraude: sem auto-indicação, 1× por indicada (dedup), sem saldo negativo.
- Configurável no `/admin`: pontos por serviço, pontos por indicação, catálogo,
  ajuste manual e resgate na ficha do cliente.
- Painel da membro e landing `/clube` no modelo de pontos.
- Parabéns via evento `club_points` para o n8n (env-gated).

### CMS — a Mi edita 100% do conteúdo ✅ no ar
- **Textos** (`/admin/conteudo`): home, sobre, dia-a-dia, noivas, debutantes
  (eyebrow, títulos, subtítulos, CTAs) — ~27 chaves, com fallback de fábrica.
- **Pacotes e FAQs** (`/admin/pacotes`): vitrines de noiva/debutante editáveis
  (nome, preço, itens, destaque, perguntas/respostas). FAQ alimenta o JSON-LD.
- **Tabela de ensaio externo** (debutante) editável via CMS.
- Já editáveis antes: serviços/preços (`/admin/servicos`), fotos
  (`/admin/fotos`), depoimentos (`/admin/depoimentos`).

### Painel do `/admin`
Agenda · Resumo · Serviços · Fotos · Textos · Pacotes · Depoimentos · Bloqueios
· Clientes · Clube · Usuárias · Configurações.

## Sessões anteriores (v3 — M8–M14, já em produção)
- **M8** SEO técnico (canonical, OG dinâmico, FAQPage/BeautySalon JSON-LD),
  headers de segurança (HSTS/CSP/X-Frame/nosniff/Referrer), `media_assets` (WebP).
- **M9** Linha Dia a Dia (cabelo + sobrancelha) + `service_availability` por
  serviço + página `/dia-a-dia` + wizard `?servico=` + editor de disponibilidade.
- **M10** Encaixe manual + visão semana + remarcação.
- **M11** Ficha da cliente / CRM (alergia, notas, consentimento de foto, histórico).
- **M12** Galeria (`/galeria`) + depoimentos (CRUD).
- **M13** Senha 12+, bloqueio progressivo de login, renomear conta, reset por
  e-mail (Resend), auditoria de segredos.
- **M14** Aba "Resumo" (faturamento, atendimentos, ocupação, no-show, origem).
- Base (M1–M7): motor de agendamento, vitrine, NextAuth, deploy automatizado.

## Definição de sucesso — status
- ✅ Zero funcionalidade quebrada (todas as rotas 200 em prod).
- ✅ A Mi edita 100% do conteúdo pelo painel.
- ✅ Motor de agendamento fiel à `miespecialista` (sáb/dom 09–19, buffer 15min,
  antecedência, sem double-booking, noiva/debutante não agendáveis, sem cílios).
- ✅ Clube de fidelidade com pontuação por serviço + indicação e recompensas
  configuráveis.
- ✅ Estética premium (branco/bege/marrom, Cormorant + Jost), copy na voz da Mi.
- ✅ SEO local (JSON-LD, sitemap, robots) e imagens WebP.
- ✅ Segurança (headers, senha forte, anti brute-force) e LGPD (anamnese
  autenticada, foto só com consentimento); sem segredos no Git.

## Pendências (fora do código do app)
- **n8n / Evolution**: importar os workflows (`n8n/`), subir a instância
  `evo-miozorio`, setar `N8N_WEBHOOK_URL` + `EVOLUTION_*` no Dokploy → ativa o
  WhatsApp (parabéns do clube, confirmação de encaixe, crons de aniversário/
  +1ano/pós-D+1/reconexão).
- **Anexo A** (dados do negócio): chave do Resend; depoimentos e fotos reais;
  preços/dias do dia a dia; valores de pontos por serviço/indicação e o
  catálogo de recompensas (hoje com placeholders, editáveis no `/admin`).
