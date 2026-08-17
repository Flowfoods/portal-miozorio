# Incidente 16/08/2026 — Ficha de clientes fora do ar + WhatsApp sem parear

> Operação Resgate (Bruce). Relatório técnico da auditoria em
> `docs/auditoria/RESGATE-2026-08-16.md`. Este documento é a versão
> em linguagem simples + runbook de prevenção.

## Linha do tempo

| Quando | O quê |
|---|---|
| 05/07 | CRM2 F3 adiciona o bloco "Atividade no site" na ficha da cliente — **com o bug que derrubaria a ficha** (ninguém percebeu: teste não roda SQL cru) |
| ~início de ago | Pareamento do WhatsApp passa a ser recusado pelo celular ("Não é possível conectar novos dispositivos") |
| 16/08 (dia) | Sessão 1 corrige 3 causas do WhatsApp: instância corrompida (recriar), QR trocando a cada 5s (cache 18s), logout que derrubava o container (guarda do 428). Fixa a versão do WhatsApp Web na atual |
| 16/08 (noite) | Sessão 2 (esta): captura o digest do erro da ficha em produção, acha a causa raiz, deploya a correção; pareamento refeito com o número da Mi → `open`; mensagem de teste entregue |

## Causa raiz de cada bug (linguagem simples)

**BUG A — "Ops, algo deu errado" ao abrir qualquer cliente.**
A tela da ficha pergunta ao banco "quantas visitas essa cliente fez no site?".
Essa pergunta era feita comparando um campo do tipo *uuid* (o RG da cliente)
com um texto comum — e o Postgres não aceita comparar coisas de tipos
diferentes sem conversão explícita. Resultado: a pergunta explodia, e a tela
inteira caía junto (o Next.js derruba a página toda quando qualquer pedaço do
carregamento falha). **TODAS as fichas quebravam, desde 05/07.**
Correção: conversão explícita (`$1::uuid`) + a seção de atividade virou
"fail-soft" — se ela falhar de novo por qualquer motivo, a ficha continua de
pé, só sem esse bloco.

**BUG B — celular recusava conectar o WhatsApp.**
Três problemas somados (corrigidos na sessão 1 de 16/08): a instância na
Evolution estava com registro corrompido (o processo nem tentava parear — sem
rastro em log verboso), o QR era regenerado a cada consulta da tela (câmera
nunca validava e o teto de 30 QRs queimava em 2,5 min), e o botão de
recomeçar chamava logout num estado em que o Baileys lança 428 — **derrubando
o container inteiro**. Por fim, a versão do WhatsApp Web anunciada no
pareamento precisava ser atual (`CONFIG_SESSION_PHONE_VERSION`) — foi fixada
na versão corrente. Infra conferida nesta sessão: Evolution v2.3.7 (última
estável), relógio da VPS exato (checado pelo header `Date`), versão pinada =
versão mais atual do rastreador oficial. Pareamento refeito por **código de
8 dígitos** (não QR) → conectado com o número oficial (21 97022-5231).

## O que mudou (commits do deploy 9f76957)

- `9333dfe` fix(clientes): cast `::uuid` + atividade fail-soft — **a correção do BUG A**
- `6bbee22` fix(admin): a tela de erro agora mostra `Código do erro: <digest>` —
  o próximo print de erro já chega diagnosticável
- `1d252db` chore(deps): next-auth 4.24.15 (fecha CVE crítica) + nanoid 3.3.18
- `94f4c79` docs: relatório da auditoria

Sem migração de banco. Rollback = redeploy da imagem anterior no Dokploy.

## Como prevenir a recorrência

1. **SQL cru com uuid**: todo `$queryRawUnsafe` com parâmetro de id DEVE usar
   `$n::uuid`. O vitest não executa SQL cru — revisão manual nesse padrão.
   (Varredura de 16/08: este era o único caso no repo.)
2. **Seção auxiliar nunca derruba a página**: bloco informativo (atividade,
   estatística) sempre com `.catch` e fallback vazio.
3. **Digest visível**: mantido no error boundary do admin. Erro em produção →
   pedir print → buscar o número nos logs do Dokploy (aba Logs do app).
4. **WhatsApp**: parear SEMPRE pelo código de 8 dígitos (tela de Configurações
   → WhatsApp). Se a instância travar: "Começar de novo" (recria). NUNCA
   mexer no logout direto na Evolution.
5. **Monitor de conexão** (a implementar): cron a cada 15 min consultando
   `connectionState`; se ≠ `open`, avisar Rodolfo no WhatsApp via instância
   do FlowFoods (não pela da Mi, que é justamente a que pode estar caída).

## Runbook — se voltar a acontecer

**Ficha quebrou de novo:** pedir print (vem com o código do erro) → Dokploy →
app portal-miozorio → Logs → buscar o código → o stack aponta arquivo:linha.

**WhatsApp caiu:** admin → Configurações → WhatsApp. Estado `close`? →
"Começar de novo" → conectar pelo número (código de 8 dígitos). Se a Evolution
não responder: Dokploy → compose evo-miozorio → Reload. Verificação rápida sem
login: `https://evo.miozorio.com.br/` responde com a versão.

**Deploy não dispara no push:** o webhook não cobre push direto — usar o botão
Deploy do app no Dokploy (ou abrir PR e mergear, que o webhook cobre).

## Pendências / backlog (S3 e higiene)

- **Rotacionar** a `AUTHENTICATION_API_KEY` da Evolution e a senha do
  Postgres `evo` (aparecem no compose do Dokploy; higiene pós-diagnóstico).
- Upgrade Next 14 → 16 (2 advisories altas restantes) — projeto à parte.
- Definir preço dos 4 serviços de cabelo "a combinar" (decisão da Mi).
- Monitor de `connectionState` a cada 15 min (item 5 acima).
- Crawler autenticado completo da Fase 5 (auditoria de botões módulo a módulo).
