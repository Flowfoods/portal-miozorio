# 02 — Plano Mestre de Evolução · Portal Mi Ozorio

Status por onda (legenda: ✅ no ar · 🟡 parcial · ❌ pendente).

| Onda | Objetivo | Status | Observação |
|------|----------|--------|------------|
| **A** | Correções críticas & quick wins | ✅ | Nada quebrado; noiva/debutante já não-agendáveis; WhatsApp correto |
| **B** | Backend Admin & CMS (Mi edita tudo) | ✅ no ar | Textos, pacotes, FAQs, ensaio, serviços, fotos, depoimentos |
| **C** | Motor de agendamento (miespecialista) | ✅ | Motor ✅; **crons n8n construídos** (lembrete véspera + pós-D+1 + aniversário/+1ano/reconexão) — só falta a Mi/infra **ativar** no n8n |
| **D** | Clube de Fidelidade (pontos) | ✅ no ar | Pontos serviço+indicação, recompensas, saldo/extrato, antifraude |
| **E** | UI/UX, Marca & Conversão | ✅ | Design premium + copy da Mi + prova social + vitrines (trabalho M3/M8) |
| **F** | Performance & SEO local | ✅ | WebP, JSON-LD, sitemap/robots, OG; + manifest/theme-color/Permissions-Policy |
| **G** | Segurança & LGPD | ✅ | Headers, senha forte, anti brute-force, LGPD; incidente de segredo tratado + key rotacionada |
| **H** | Validação final & entrega | ✅ | Validação por HTTP + CHANGELOG; **aceite E2E do WhatsApp comprovado**; mobile 390px re-validado |

## Itens em aberto (com responsável)
> Tudo que era **código/artefato** está concluído e (exceto a ativação do n8n)
> em produção. O que resta depende de ações operacionais da Mi/Rodolfo:

| Item | Resp. | Como |
|------|-------|------|
| **Ativar** os crons do n8n | Mi/infra | Importar `n8n/mi-ozorio-crons-clube.workflow.json`, criar credencial Postgres, setar EVOLUTION_* — runbook em `docs/RUNBOOK-n8n-ativacao.md` |
| Anexo A (dados da Mi) | Mi | Preços/dias do dia a dia; depoimentos e fotos reais; conta Resend — tudo editável no `/admin` |
| Rotação da senha pessoal do Rodolfo | Rodolfo | Trocar a senha exposta no chat; (opcional) purgar histórico git do segredo antigo |

## Definição de Sucesso — status
✅ Zero funcionalidade quebrada · ✅ **Mi edita 100% do conteúdo** (textos, listas de
serviços/diferenciais/formações, jornada, pacotes, FAQs, **e os textos das mensagens
de WhatsApp**) · ✅ Motor fiel à miespecialista · ✅ Clube por pontos configurável ·
✅ Estética premium · ✅ Perf/SEO · ✅ Segurança/LGPD · ✅ **WhatsApp automático
comprovado (E2E)**.

🏁 **Critérios de sucesso cumpridos.** Para a operação 24/7 dos lembretes por tempo,
falta só **ativar os workflows no n8n** (passo operacional, runbook pronto).
