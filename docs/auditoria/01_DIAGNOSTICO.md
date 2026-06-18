# 01 — Diagnóstico · Portal Mi Ozorio

Legenda: ✅ OK · 🟡 Parcial · ❌ Faltando

## Status funcional (verificado em produção)
| Área | Status | Nota |
|------|--------|------|
| Rotas públicas | ✅ | Todas 200, sem quebra |
| Agendamento (wizard) | ✅ | 5 passos; `?servico=`; slots do motor |
| Painel admin | ✅ | Agenda dia/semana, encaixe, remarcar, CRUD completo |
| CMS (Mi edita conteúdo) | ✅ | Textos, pacotes, FAQs, ensaio, serviços, fotos, depoimentos |
| Clube de fidelidade | ✅ | Pontos por serviço + indicação, recompensas, saldo/extrato |
| WhatsApp (Evolution) | 🟡 | Conectado e envio testado; reconexão pós-rotação pendente de re-scan |
| Lembrete 24h / pós-atendimento | ❌ | Crons n8n não construídos |

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

## Pontos fracos / gaps
- 🟡 **Automações por tempo (n8n)** não construídas: lembrete 24h, pós-atendimento
  (avaliação Google/foto), aniversário/+1ano/reconexão.
- 🟡 **WhatsApp** depende da instância Evolution conectada (re-scan após redeploys).
- 🟡 **Anexo A pendente com a Mi:** preços/dias reais do dia a dia, depoimentos e fotos reais, Resend (reset).
- 🟡 **Segurança:** API key da Evolution antiga vazou no histórico do git (rotacionada;
  histórico não purgado). Chave do Bibi e senha foram expostas em suporte → rotacionar.
- 🟡 **Validação mobile 390px**: herdada do design mobile-first; sem re-teste formal dedicado.
