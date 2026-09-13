# Deploy das correções de auth (B1–B5) — roteiro

> Para rodar **da máquina do Rodolfo** (onde vivem a chave do Dokploy e a rota
> até a VPS). O container do Claude Code na web não alcança o Dokploy e não tem
> a credencial — R9.
>
> App: `portal-miozorio` · `applicationId` `rQ_sgLhWZyb6ihF0nbs4a` · projeto
> `miozorio`.

---

## 1. Antes de apertar qualquer botão

- [x] PR [#104](https://github.com/Flowfoods/portal-miozorio/pull/104) com os
      dois jobs do CI verdes e revisado. (O CI passou a existir em 13/09, pela
      master — antes deste PR não havia check nenhum.)
- [x] Merge na `master` — feito em 13/09 20:58 (`d8574cf`).

## 2. Variáveis de ambiente no Dokploy

Colar antes do deploy (o app lê no boot):

```
MI_WHATSAPP=+5521970225231
AUTH_CANONICAL_HOST=miozorio.com.br
MI_WHATSAPP_EMERGENCIA=+55219XXXXXXXX
```

As outras duas (`AUTH_EXTRA_ORIGINS`, `AUTH_COOKIE_DOMAIN`) ficam **vazias** —
só existem como escape hatch.

### ⚠️ `MI_WHATSAPP` é a que não pode faltar

**Confira o valor dela no Dokploy antes de apertar deploy.** Ela já existia no
`.env.example`, mas até agora nenhum código do portal a lia — então nunca fez
diferença se estava vazia. A partir deste deploy ela é **o destino do código de
recuperação**. Vazia ou malformada:

- `numerosDaMi()` devolve lista vazia;
- o pedido é gravado com `notify_error: "MI_WHATSAPP não configurado"`;
- a cliente lê _"a Mi vai te mandar o código"_ e espera um código que não
  saiu de lugar nenhum.

Ou seja: **falha calada**, do lado de quem está trancada fora. O passo 4 do
smoke test pega isso — mas conferir a env custa 10 segundos e evita descobrir
pelo WhatsApp da Mi.

⚠️ **Não confunda o nome.** São duas envs diferentes, com os nomes trocados de
posição, guardando o mesmo número:

| Env           | De quem é       | Formato        | Se faltar                             |
| ------------- | --------------- | -------------- | ------------------------------------- |
| `MI_WHATSAPP` | auth (B2)       | E.164 (`+55…`) | **falha silenciosa** — código não sai |
| `WHATSAPP_MI` | agenda (A1–A11) | URL do `wa.me` | cai num número fixo no código         |

Como as duas frentes sobem no mesmo deploy, as duas precisam estar certas.

⚠️ Se algum dia o redirect entrar em laço (Traefik reescrevendo o Host),
`AUTH_CANONICAL_HOST=off` desliga **sem precisar de deploy**.

## 3. Deploy

`application.deploy` pela API tRPC, como sempre. O entrypoint roda
`prisma migrate deploy` + `seed --if-empty` sozinho.

⚠️ **Este deploy carrega DUAS frentes.** A master recebeu, antes desta, a
frente de agendamento A1–A11 (PR #103), que trouxe 6 migrations próprias. Se
ela ainda não foi para produção, o runbook dela —
`docs/agenda/RUNBOOK-DEPLOY.md` — vale junto com este; as envs de pagamento
(`PAGAMENTO_PROVIDER`, `MP_*`) são de lá.

**As duas migrations desta frente são aditivas** (R11). As 8 (as 6 da agenda
mais estas) foram aplicadas do zero num PostgreSQL 16 limpo durante a
verificação, já na ordem final:

| Migration                           | O que faz                                                                                                                                                |
| ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `20260913000000_auth_b1_identidade` | cria `customers.club_token_version`; normaliza e-mails existentes **sem colidir** com o UNIQUE; cria índice em `lower(email)` só se não houver duplicado |
| `20260913070000_recuperacao_unica`  | cria a tabela `password_recoveries`                                                                                                                      |

> A segunda nasceu como `20260913010000_` e foi renomeada: colidia com o
> carimbo da `20260913010000_a7_sinal_regra`, que veio pela master. As duas
> conviveriam só por sorte alfabética. Renomear foi seguro porque nenhuma
> delas tinha ido para produção ainda — **não repita isso com migration já
> aplicada**.

Nada é apagado. `club_password_resets` e `password_reset_tokens` continuam lá.
**Ninguém é deslogado**: a versão do token começa em 0, que é o valor que os
cookies já emitidos assumem.

## 4. Health

```
https://miozorio.com.br/api/health   →   {"app":"ok","db":"ok",...}
```

## 5. Smoke test (5 minutos, pelo celular em 390px)

| #   | O que fazer                                                             | Esperado                                                     |
| --- | ----------------------------------------------------------------------- | ------------------------------------------------------------ |
| 1   | Abrir `https://www.miozorio.com.br/clube/entrar`                        | cai em `https://miozorio.com.br/clube/entrar`                |
| 2   | Entrar no Clube com um telefone de teste **digitado com `+55`**         | entra (era exatamente o que falhava)                         |
| 3   | Errar a senha de propósito                                              | "Senha incorreta. Se não lembrar, peça um código para a Mi." |
| 4   | `/clube/recuperar` → pedir código com um número cadastrado              | **o WhatsApp da Mi apita** com nome, número, código e prazo  |
| 5   | Esperar uns minutos, digitar o código, demorar na tela da senha, salvar | entra direto — sem "seu código expirou"                      |
| 6   | No painel, ficha de uma cliente → "Gerar código de recuperação"         | código na tela + botão que abre a conversa dela              |
| 7   | `/admin/recuperar` com o e-mail da Mi                                   | código chega no WhatsApp dela                                |

Se o passo 4 não apitar: `Configurações → Acessos` mostra o pedido registrado e
o motivo (a Evolution pode estar desconectada). O código não se perde.

## 6. Traefik — opcional

⚠️ Infra compartilhada, precisa do seu OK.

O app já redireciona `www` → apex sozinho (passo 1 do smoke). Fazer o mesmo no
Traefik só economiza um salto: no router do `portal-miozorio`, um middleware
`redirectRegex` de `^https://www\.miozorio\.com\.br/(.*)` para
`https://miozorio.com.br/$1`, permanente.

## 7. Se der errado

Rollback pelo Dokploy (deploy anterior). As migrations **não** precisam ser
revertidas: as duas são aditivas e a versão antiga do código simplesmente ignora
a coluna e a tabela novas.

⚠️ O rollback volta as **duas** frentes de uma vez (auth e agendamento), já
que as duas entram no mesmo deploy. Não dá para desfazer só uma.

O único ponto sem volta é a rota `/admin/redefinir/<token>`, que deixou de
existir. Se houver e-mail de reset antigo em voo, o link dá 404 — o caminho é
`/admin/recuperar`. Emergência de acesso ao painel continua sendo
`scripts/reset-admin-password.ts` na VPS.

## 8. Depois

- Avisar a Mi que o código de recuperação agora chega **no WhatsApp dela**, e
  que ela repassa para a cliente (o texto já vem pronto para encaminhar).
- Se ela quiser mudar o prazo do código: `Configurações → "Código de
recuperação vale (min)"`, mínimo 15.
