# 01 — Diagnóstico · Portal Mi Ozorio

Legenda: ✅ OK · 🟡 Parcial · ❌ Faltando

## Status funcional (verificado em produção)
| Área | Status | Nota |
|------|--------|------|
| Rotas públicas | ✅ | Todas 200, sem quebra |
| Agendamento (wizard) | ✅ | 5 passos; `?servico=`; slots do motor |
| Painel admin | ✅ | Agenda dia/semana, encaixe, remarcar, CRUD completo |
| CMS (Mi edita conteúdo) | ✅ | Textos, listas de serviços/diferenciais/formações, jornada, pacotes, FAQs, ensaio, serviços, fotos, depoimentos **e os textos das mensagens de WhatsApp** — home/sobre/noivas/debutantes 100% editáveis |
| Clube de fidelidade | ✅ | Pontos por serviço + indicação, recompensas, saldo/extrato |
| WhatsApp (Evolution) | ✅ | Instância `miozorio` conectada; **E2E comprovado** (envio chega). Evolution dedicada e isolada |
| Lembrete véspera / pós-atendimento | ✅ | Crons n8n **construídos** (lembrete véspera, pós-D+1, aniversário, +1ano, reconexão); falta só **ativar** no n8n (runbook pronto) |

## Validação contra a `miespecialista`
- ✅ Noiva (La Mariée) e Debutante **não agendáveis** → vitrine + CTA WhatsApp (R1)
- ✅ Agendáveis: maquiagem social, penteado, sobrancelha, cabelo (dia a dia), curso
- ✅ **Sem cílios** ofertados
- ✅ Sáb/dom 09–19h (curso pode dia de semana); buffer 15 min; antecedência mínima
- ✅ Anamnese obrigatória (alergia/referência/ocasião)
- ✅ Curso: 2h, vaga única, R$280
- ✅ Sem double-booking (constraint `no_overlap` EXCLUDE gist no banco)
- ✅ WhatsApp (21) 97022-5231

## Pontos fortes
- Motor de agendamento robusto e fiel às regras; auditoria em `booking_events`.
- CMS amplo — a Mi controla quase todo o conteúdo sem código.
- Clube por pontos completo, com antifraude (dedup, sem auto-indicação, sem saldo negativo).
- Estética premium (branco/bege/marrom, Cormorant+Jost); copy na voz da Mi.
- Segurança: HSTS/CSP/X-Frame/nosniff/Referrer/Permissions-Policy; senha 12+;
  bloqueio progressivo; reset por e-mail; LGPD (anamnese autenticada, foto só com consentimento).
- SEO: JSON-LD BeautySalon/FAQPage, sitemap, robots, OG dinâmico, canonical; imagens WebP.

## Pontos fracos / gaps (atualizado — restam só itens operacionais)
- 🟡 **Ativar** as automações por tempo no n8n: os workflows estão **construídos e
  versionados** (`n8n/`), falta importar + credencial Postgres + envs (runbook
  `docs/RUNBOOK-n8n-ativacao.md`). Operação da Mi/infra.
- 🟡 **Anexo A pendente com a Mi:** preços/dias reais do dia a dia, depoimentos e
  fotos reais, conta Resend (reset por e-mail). Tudo editável no `/admin`.
- 🟡 **Segurança:** senha pessoal do Rodolfo exposta em chat → trocar; (opcional)
  purgar histórico git do segredo antigo já rotacionado. *(A chave `9944…`/`bibi-principal`
  é da infra compartilhada/projeto Bibi — fora do escopo deste portal.)*

> ✅ **Resolvidos nesta rodada:** automações por tempo construídas (inclui lembrete
> da véspera); WhatsApp conectado + E2E comprovado; mobile 390px re-validado;
> mensagens e todo o conteúdo público editáveis pela Mi.
