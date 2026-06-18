# 02 — Plano Mestre de Evolução · Portal Mi Ozorio

Status por onda (legenda: ✅ no ar · 🟡 parcial · ❌ pendente).

| Onda | Objetivo | Status | Observação |
|------|----------|--------|------------|
| **A** | Correções críticas & quick wins | ✅ | Nada quebrado; noiva/debutante já não-agendáveis; WhatsApp correto |
| **B** | Backend Admin & CMS (Mi edita tudo) | ✅ no ar | Textos, pacotes, FAQs, ensaio, serviços, fotos, depoimentos |
| **C** | Motor de agendamento (miespecialista) | 🟡 | Motor ✅; **lembrete 24h + pós-atendimento (avaliação/foto) = crons n8n não construídos** |
| **D** | Clube de Fidelidade (pontos) | ✅ no ar | Pontos serviço+indicação, recompensas, saldo/extrato, antifraude |
| **E** | UI/UX, Marca & Conversão | ✅ | Design premium + copy da Mi + prova social + vitrines (trabalho M3/M8) |
| **F** | Performance & SEO local | ✅ | WebP, JSON-LD, sitemap/robots, OG; + manifest/theme-color/Permissions-Policy |
| **G** | Segurança & LGPD | ✅ | Headers, senha forte, anti brute-force, LGPD; incidente de segredo tratado + key rotacionada |
| **H** | Validação final & entrega | 🟡 | Validação por HTTP + CHANGELOG ✅; **falta aceite E2E do WhatsApp** |

## Itens em aberto (com responsável)
| Item | Resp. | Como |
|------|-------|------|
| Aceite E2E do WhatsApp (parabéns automático) | Mi/Rodolfo | Re-escanear a instância `miozorio` (Manager) + concluir um atendimento do clube |
| Automações n8n por tempo (lembrete 24h, pós-D+1, aniversário, +1ano, reconexão) | infra | Importar/montar workflows n8n (queries no Postgres) — `n8n/README.md` |
| Anexo A (dados da Mi) | Mi | Preços/dias do dia a dia; depoimentos e fotos reais; conta Resend |
| Rotação de segredos restantes | Rodolfo | Chave do Bibi (`9944…`) + senha; (opcional) purgar histórico git |

## Definição de Sucesso — status
✅ Zero funcionalidade quebrada · ✅ Mi edita 100% do conteúdo · ✅ Motor fiel à
miespecialista · ✅ Clube por pontos configurável · ✅ Estética premium · ✅ Perf/SEO ·
✅ Segurança/LGPD (segredo antigo rotacionado; histórico a purgar).

🟡 **Pendente para "100%":** aceite E2E do WhatsApp + automações n8n por tempo + Anexo A.
