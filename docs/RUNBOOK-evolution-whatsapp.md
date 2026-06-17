# Runbook — Evolution não gera QR (afeta Mi e Bibi)

**Data:** 2026-06-17 · **Servidor:** `evo.76.13.230.78.sslip.io` (Evolution v2.2.3)
**Impacto:** todas as instâncias do servidor — `evo-miozorio` (Mi) **e** `bibi-principal` (Bibi).

## Diagnóstico (CONFIRMADO por log)
O container `evolution-api` entra em loop, sem nunca emitir o QR:
```
[evo-miozorio] connected to WA
"msg":"not logged in, attempting registration..."   (appVersion 2.3000.1015307)
error ... "Error: Connection Failure" ... "msg":"connection errored"
(repete)
```
**Causa:** a **versão do WhatsApp Web** usada pela Evolution (`2.3000.1015307`) está
**desatualizada** — o WhatsApp recusa a conexão e fecha antes de gerar o QR.
Por isso o QR vem em branco no Manager, e o Bibi também está desconectado.

## Conserto (escolher A ou B) — APLICAR POR HUMANO

> ⚠️ Os dois reiniciam o `evolution-api`, que **derruba temporariamente o WhatsApp
> do Bibi também**. Faça em horário de baixo movimento. Depois reconecte/verifique
> o Bibi (instância `bibi-principal`) no mesmo Manager.

### Opção A — Atualizar a Evolution (mais estável)
1. Backup mental: anote a imagem atual `atendai/evolution-api:latest` (v2.2.3).
2. Forçar pull da imagem nova e recriar o serviço:
   - Se gerenciado no Dokploy: serviço `evolution-api` → **Redeploy** (com pull) ou
     pinar uma tag 2.3.x recente → Deploy.
   - Se for swarm puro (não-Dokploy), no host:
     ```
     docker service update --image atendai/evolution-api:latest --force evolution-api
     ```
3. Aguardar subir → abrir Manager → `evo-miozorio` → **Obtenha o Código QR** (deve
   aparecer agora) → escanear. Repetir para `bibi-principal`.

### Opção B — Fixar a versão do WhatsApp Web (rápido)
1. No env do `evolution-api`, ajustar:
   ```
   CONFIG_SESSION_PHONE_VERSION=<versão atual do WhatsApp Web>
   ```
   A versão válida muda toda semana. Onde achar a atual:
   - Issues do repo `EvolutionAPI/evolution-api` (procurar "Connection Failure" /
     "phone version"), ou
   - de uma sessão aberta em `web.whatsapp.com` (DevTools → versão do cliente).
2. Reiniciar o `evolution-api`.
3. Manager → QR → escanear (Mi e Bibi).

## Depois que o QR funcionar e a Mi conectar
O **portal já está pronto** e emite os eventos. Falta só (eu dirijo):
1. Importar o workflow `n8n/mi-ozorio-whatsapp.workflow.json` no n8n e setar no env do n8n:
   `EVOLUTION_API_URL=https://evo.76.13.230.78.sslip.io`, `EVOLUTION_API_KEY=<global>`,
   `EVOLUTION_INSTANCE=evo-miozorio`, `MI_WEBHOOK_TOKEN=<defina um>`.
2. Copiar a Production URL do Webhook do n8n → setar `N8N_WEBHOOK_URL` (+ `N8N_WEBHOOK_TOKEN`)
   no app `portal-miozorio` (Dokploy) → redeploy.
3. Teste real: concluir um atendimento de cliente indicada → "parabéns" chega no WhatsApp.

## Segurança
- A `AUTHENTICATION_API_KEY` da Evolution apareceu no chat durante o suporte —
  **rotacionar** após resolver (gerar nova no env + reconectar instâncias).
- Trocar a senha que foi colada no chat.
