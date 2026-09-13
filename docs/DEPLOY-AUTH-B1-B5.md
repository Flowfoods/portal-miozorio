# Deploy das correções de auth (B1–B5) — roteiro

> Para rodar **da máquina do Rodolfo** (onde vivem a chave do Dokploy e a rota
> até a VPS). O container do Claude Code na web não alcança o Dokploy e não tem
> a credencial — R9.
>
> App: `portal-miozorio` · `applicationId` `rQ_sgLhWZyb6ihF0nbs4a` · projeto
> `miozorio`.

---

## 1. Antes de apertar qualquer botão

- [ ] PR [#104](https://github.com/Flowfoods/portal-miozorio/pull/104) com CI
      verde e revisado.
- [ ] Merge na `master`.

## 2. Variáveis de ambiente no Dokploy

Colar antes do deploy (o app lê no boot):

```
AUTH_CANONICAL_HOST=miozorio.com.br
MI_WHATSAPP_EMERGENCIA=+55219XXXXXXXX
```

As outras duas (`AUTH_EXTRA_ORIGINS`, `AUTH_COOKIE_DOMAIN`) ficam **vazias** —
só existem como escape hatch.

⚠️ Se algum dia o redirect entrar em laço (Traefik reescrevendo o Host),
`AUTH_CANONICAL_HOST=off` desliga **sem precisar de deploy**.

## 3. Deploy

`application.deploy` pela API tRPC, como sempre. O entrypoint roda
`prisma migrate deploy` + `seed --if-empty` sozinho.

**As duas migrations são aditivas** (R11) e foram aplicadas do zero num
PostgreSQL 16 limpo durante a verificação:

| Migration                           | O que faz                                                                                                                                                |
| ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `20260913000000_auth_b1_identidade` | cria `customers.club_token_version`; normaliza e-mails existentes **sem colidir** com o UNIQUE; cria índice em `lower(email)` só se não houver duplicado |
| `20260913010000_recuperacao_unica`  | cria a tabela `password_recoveries`                                                                                                                      |

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

O único ponto sem volta é a rota `/admin/redefinir/<token>`, que deixou de
existir. Se houver e-mail de reset antigo em voo, o link dá 404 — o caminho é
`/admin/recuperar`. Emergência de acesso ao painel continua sendo
`scripts/reset-admin-password.ts` na VPS.

## 8. Depois

- Avisar a Mi que o código de recuperação agora chega **no WhatsApp dela**, e
  que ela repassa para a cliente (o texto já vem pronto para encaminhar).
- Se ela quiser mudar o prazo do código: `Configurações → "Código de
recuperação vale (min)"`, mínimo 15.
