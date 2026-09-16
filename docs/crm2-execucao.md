# CRM 2.0 — Registro de execução (F0–F6)

> Executado em 2026-07-05, uma fase por PR, deploy validado a cada merge.
> Diagnóstico inicial: `docs/crm2-diagnostico.md`.

## O que entrou em produção

| Fase | PR | Entrega |
|---|---|---|
| F0 | — | Diagnóstico (schema, RFV por quintis, sessão cliente, gaps) |
| F1 | #77 | Eventos first-party: `client_events`, cookie `mi_sid`, beacon `/api/track` (whitelist + clientId só do servidor), merge anônimo→cliente no login, funil do wizard, LGPD (privacidade + cascade) |
| F2 | #79 | Régua RFV editável: `crm_config` versionado (histórico quem/quando/de→para), faixas fixas, segmentos com nomes livres, prévia sem gravar, recálculo imediato; defaults reproduzem a segmentação anterior (provado em teste no grid 125) |
| F3 | #80 | Listas acionáveis (`/admin/crm/listas`): sumidas, nunca entraram, visitou-não-marcou, engajadas na indicação, explorar com filtros; CSV; WhatsApp com rascunho; "Atividade no site" na ficha |
| F4 | #82 | **Fila de aprovação** (`/admin/crm/mensagens`): réguas sumida/abandono/lead fria SÓ SUGEREM; a Mi edita e envia; jornadas pararam de auto-enviar; ritmo/teto/templates na config; `envios_mensagem.texto` |
| F5 | #83 | Funil 2.0: kanban arrastável (+botões no toque), alerta de parada, valor do pipeline, tempo médio por etapa (`funil_eventos`), WhatsApp por etapa via CMS |
| F6 | (este) | Retenção de eventos (`/api/cron/limpeza-eventos`, N meses configurável), auditoria e este registro |

## Regra da casa (definida pelo Rodolfo em 2026-07-05)

**Nenhuma mensagem de WhatsApp de relacionamento é enviada automaticamente.**
Toda mensagem passa pela fila (`/admin/crm/mensagens`) onde a Mi lê, edita e
personaliza antes de enviar — e o ritmo (dias entre mensagens por cliente) e a
quantidade (sugestões/dia) são configuração dela. Modo automático **não existe**
de propósito. Mensagens transacionais (confirmação de horário, lembrete da
véspera) continuam automáticas — são operacionais, não de relacionamento.

## Auditoria (F6)

- **Autorização**: páginas `/admin/**` cobertas pelo middleware (NextAuth);
  toda server action nova chama `requireAdmin()`; CSV exige sessão; crons
  (`rfv`, `reguas`, `limpeza-eventos`, `jornadas`, `lembretes`) exigem
  `CRON_SECRET` (fail-closed). Verificado por smoke em produção (307/401).
- **LGPD**: eventos sem PII/dado de saúde (`sanitizeMeta` + teste); cascade na
  exclusão da cliente (`client_events`, `funil_eventos`); retenção configurável
  com job de limpeza; opt-in obrigatório nas réguas; política de privacidade
  atualizada (F1).
- **Performance**: base atual é pequena (estúdio individual) — decidimos NÃO
  materializar contadores (`ClientStats`) por ora; os índices de `client_events`
  `(client_id, tipo, created_at)` e `(tipo, created_at)` cobrem as agregações.
  Reavaliar se o dashboard passar de ~2s (medir antes de otimizar).
- **Regressão**: suíte com 200+ testes verdes em todas as fases; deploys
  validados com health + smoke de rotas.

## ⚠️ Pendências operacionais (1× no Dokploy → Schedules)

Os crons novos precisam ser agendados (os antigos rfv/lembretes/jornadas já existem):

```
# diário, ex. 08:45 América/São Paulo (depois do rfv das 08:30)
curl -fsS -X POST https://miozorio.com.br/api/cron/reguas -H "Authorization: Bearer $CRON_SECRET"

# semanal, ex. domingo 04:30
curl -fsS -X POST https://miozorio.com.br/api/cron/limpeza-eventos -H "Authorization: Bearer $CRON_SECRET"
```

## Copies — revisadas em 14/09/2026

Os marcadores de aprovação saíram do código. **O que foi aprovado é um texto de
partida, não um piloto automático**: nada aqui é enviado sozinho. As jornadas
nascem desativadas e, desde a F4, só *sugerem* na fila da Mi (`jornadas.ts`); as
réguas nascem `ativas: false`; as listas e o funil abrem o WhatsApp com o texto
pronto para ela editar antes de mandar.

Três coisas mudaram, e por quê:

1. **Saiu a gíria.** "bora marcar" virou "que tal reservarmos". A voz da marca é
   acolhedora **sem** gíria — próxima e sofisticada ao mesmo tempo.
2. **Saiu o rastreio da mensagem.** "Vi que você deu uma olhadinha nos horários"
   e "Vi seu cadastro por aqui" contavam à cliente que o site registrou o que
   ela fez. Convidar é acolhedor; avisar que foi observada não é. O gatilho
   continua existindo — quem muda é só o que a mensagem diz.
3. **Regra para o 💛**, para não virar gosto pessoal na próxima edição: fica nos
   momentos de emoção (primeiro contato, resultado da prévia, contrato,
   pós-evento) e sai dos operacionais (agendar prévia, confirmar horários).

Tudo segue editável sem deploy: réguas em `/admin/crm/config`, funil em
`/admin/conteudo` (grupo "Mensagens de WhatsApp · Funil de noiva").

### Ainda aberto

- Revisar limiares default: sumida 120d, lead fria 14d, parada no funil 14d,
  intervalo entre mensagens 7d, teto 10/dia, retenção 24 meses.
