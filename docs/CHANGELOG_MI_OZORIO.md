# Changelog — Portal Mi Ozorio

Registro do que foi entregue por frente. Produção: **https://miozorio.com.br**.

> Observação: o super-prompt citava o domínio `mileneozorio.com`, que **não existe**.
> O portal real é `miozorio.com.br` (confirmado pelo Rodolfo).

## Sessão 2026-09-13 — Frente de agendamento (A1–A11) 🟡 aguardando deploy

Motivada por um caso real: a Carla agendou Design de sobrancelha pelo site, o
sistema pediu sinal e não abriu pagamento, a Mi não foi avisada, a reserva
expirou aparecendo como "Cancelado (Mi)" e a Mi não conseguiu confirmar.

**Os 5 sintomas eram 2 ausências e 1 colisão de rótulo** — diagnóstico completo
em `docs/agenda/FASE1-DIAGNOSTICO.md`.

### O que a Mi ganha
- **É avisada de tudo** (A4): nova reserva, aguardando sinal, aguardando
  validação de tamanho, sinal pago, cancelamento e expiração — com cliente,
  telefone, serviço, dia, valor e link direto da ficha. Antes o portal **nunca**
  mandava uma mensagem para ela.
- **Consegue desfazer** (A5): "Reativar e confirmar" traz de volta agendamento
  expirado ou cancelado enquanto o horário estiver livre. E a tela parou de
  acusá-la: hold vencido pelo cron agora é **"Expirado (sistema)"**.
- **Exclui/arquiva qualquer serviço** (A1): o botão some do card só quando não
  havia histórico — agora existe em todos. Com histórico, arquiva: some do
  painel, do encaixe e do site, e o histórico fica.
- **Para de duplicar serviço** (A6): nome duplicado barrado no backend, botão
  trava em "Criando…" e o sucesso avisa com toast. `scripts/dedup-servicos.ts`
  limpa os três "Buço" que já estão no banco.
- **Encaixa sem caçar caixinha** (A8): os horários do padrão viraram atalhos e o
  campo de hora está sempre editável. Fora do padrão = aviso, não bloqueio.
- **Alerta de alergia confiável** (A11): parou de acender com "Não".

### O que a cliente ganha
- **Nunca mais fica sem saber** (A7): reserva com sinal mostra "Seu horário está
  guardado", com valor e prazo real — nunca mais a mensagem de erro que a fazia
  achar que não tinha agendado. Sinal deixou de ser exigido por padrão; a regra
  de reincidência (3 cancelamentos) continua.
- **PIX no portal** (A7, **desligado**): adaptador do Mercado Pago pronto, com
  webhook assinado e cron de conciliação. Enquanto as credenciais não entrarem,
  o comportamento é idêntico ao de hoje.
- **Confirmação de verdade** (A9): local com endereço, valor e orientações, em
  todo caminho que confirma. Antes, confirmar um pendente na agenda não avisava
  ninguém.
- **Descobre que ganhou pontos** (A10): ao concluir, recebe saldo anterior,
  ganho e atual + o que é o Clube + avaliação no Google e autorização de foto.
  Os pontos já eram creditados em silêncio.
- **Cardápio visual** (A2) e **escolha de tamanho com foto** (A3): serviço pode
  ter foto de exemplo e variações (cabelo curto/longo); a cliente escolhe e
  manda foto, a Mi aprova ou ajusta — e o ajuste avisa do valor novo.

### Números
360 testes (eram 246) · 6 migrations, todas aditivas · typecheck, lint e build
verdes. Verificação em `docs/agenda/FASE3-VERIFICACAO.md`, deploy passo a passo
em `docs/agenda/RUNBOOK-DEPLOY.md`.

## Sessão 2026-09-13 — QA de acessibilidade do site público (V7) 🟡 aguardando deploy

O V6 zerou o contraste das 16 rotas do `/admin` e não tocou nas 22 públicas —
os mesmos dois defeitos ficaram corrigidos de um lado só. 25 correções em 15
arquivos. Detalhe em `docs/redesign/V7-QA-SITE-PUBLICO.md`.

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
