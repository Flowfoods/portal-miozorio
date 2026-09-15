# Autenticação — correções B1 a B5

> O que mudou no login, na recuperação de senha e na segurança do portal, e o
> que precisa ser configurado à mão. Linguagem simples de propósito: esta página
> é para consultar no dia do deploy, não para impressionar.

---

## O que estava acontecendo (e por quê)

### B1 — "a senha está certa e o login não entra"

Três causas independentes, todas confirmadas no código:

1. **A máscara do campo de telefone estragava o número.** Quem digitava (ou o
   navegador preenchia) `+55 21 99862-6845` via o campo virar
   `(55) 21998-6268` — a máscara cortava os dois últimos dígitos antes de tirar
   o `+55`. O portal ia procurar um telefone que não existe. Como o autofill do
   Safari/Chrome costuma preencher em formato internacional, o bug parecia
   "depender do navegador".
2. **A senha nunca era aparada.** Teclado de celular acrescenta espaço quando a
   pessoa aceita a sugestão do corretor, e colar senha costuma trazer espaço
   junto. Quem criou a senha assim nunca mais conseguia digitá-la igual.
3. **Não havia domínio canônico.** O cookie de sessão vale só no host exato em
   que foi gravado, e as Server Actions do Next recusam o envio quando o
   `Origin` não bate com o host que o Traefik encaminha. Resultado: entrar em
   `miozorio.com.br` e abrir `www.` aparecia deslogada, e o login feito a partir
   do host "errado" simplesmente não acontecia.

### B3 — "o código expirou depois de eu confirmar ele"

O "vale" emitido na confirmação herdava a validade do código (10 min) e contava
**a partir da validação**. Quem levava mais de 10 minutos escolhendo a senha —
ou errava a regra "diferente do telefone" e tentava de novo — recebia
_"Seu código expirou"_ numa tela que já tinha dito _"Código confirmado 💛"_.
De quebra, o cookie do vale era gravado em `Path=/clube` e apagado em `Path=/`,
ou seja: nunca era apagado de verdade.

---

## Como funciona agora

### Login

- Telefone e e-mail são normalizados **do mesmo jeito** no cadastro e no login
  (`src/lib/auth-identidade.ts`). Telefone vira E.164 (`+55` + DDD + número),
  e-mail vira minúsculo sem espaço.
- A senha leva `trim` **só nas pontas** — o meio nunca é tocado, qualquer
  caractere vale, não há limite de tamanho, mínimo de 6 para a cliente e 12 para
  o painel.
- Senha antiga gravada com espaço continua entrando e é **regravada
  normalizada** no primeiro login certo. Ninguém é deslogado e nenhuma senha é
  invalidada.
- Sessão: `HttpOnly` + `Secure` + `SameSite=Lax` + `Path=/`. **Lax, nunca
  Strict** — com Strict o cookie não viaja quando a cliente chega por link do
  WhatsApp/Instagram. Cliente: 30 dias, renovados a cada ação. Painel: 7 dias.
- Mensagens dizem o que fazer: _"Não encontrei esse telefone por aqui. Quer se
  cadastrar?"_, _"Senha incorreta…"_, _"Tente de novo em 7 min"_ — com o link
  certo ao lado. **No painel a mensagem continua única** para credencial errada
  (conta de painel não se cria pelo site; diferenciar só ajudaria quem tenta
  adivinhar).
- Depois de entrar, a pessoa volta para a página que tentou abrir
  (`callbackUrl`), não para a home.

### Recuperação de senha — modelo único

Vale para **todos** os perfis (cliente e painel), pela mesma tela e pelo mesmo
módulo (`src/lib/recuperacao.ts`, tabela `password_recoveries`):

1. a pessoa informa o telefone (cliente) ou o e-mail (painel);
2. o sistema gera um código de 6 dígitos e manda **para o WhatsApp da Mi** —
   com o nome, o número cadastrado, o perfil, o código, até que horas vale e a
   mensagem pronta para ela encaminhar sem reescrever nada;
3. a Mi repassa o código para o número cadastrado;
4. a pessoa digita o código e cria a senha nova, já entrando na conta.

- **Nunca** enviamos código para número não cadastrado.
- A resposta pública é sempre a mesma, exista ou não a conta.
- O código vale **60 minutos** (ajustável em _Configurações_, mínimo 15).
- **Confirmar o código não o consome.** A confirmação emite um token de troca
  próprio de 15 minutos; só salvar a senha marca o código como usado.
- Pedir um código novo invalida os anteriores. 5 tentativas de digitação por
  código; 60s de espera entre pedidos; no máximo 3 pedidos por hora.
- A Mi também gera código direto na **ficha da cliente** (aba Clientes): o
  código aparece na tela e um botão abre a conversa da cliente com o texto
  pronto.
- Se a Mi esquecer a própria senha, o código chega no WhatsApp dela. Se o número
  principal estiver fora do ar, ele também vai para o contato de emergência
  (`MI_WHATSAPP_EMERGENCIA`).
- Se a Evolution falhar, a tela da cliente não muda: o pedido fica registrado
  com o erro em _Configurações → Acessos_ e na fila de reenvio do outbox.

### Segurança

| Camada                  | Regra                                                                |
| ----------------------- | -------------------------------------------------------------------- |
| Login por conta         | trava progressiva a partir da 5ª falha (1 min → teto 30 min)         |
| Login por identificador | 10 falhas em 15 min pausam aquele telefone/e-mail                    |
| Login por IP            | 20 falhas em 15 min (mais folgado: IP de casa é compartilhado)       |
| Pedido de código        | 60s entre pedidos + 3 por hora no mesmo cadastro                     |
| Digitação do código     | 5 tentativas, depois o código morre                                  |
| Trocar a senha          | derruba as sessões dos outros aparelhos (nos dois perfis)            |
| Hash                    | bcrypt custo 12; hash mais fraco sobe sozinho no próximo login certo |
| Guardado no banco       | só hash do código, IP hasheado, telefone mascarado                   |

---

## O que precisa ser configurado à mão

### 1. Dokploy → variáveis de ambiente

| Variável                 | Valor                         | Precisa?                                         |
| ------------------------ | ----------------------------- | ------------------------------------------------ |
| `MI_WHATSAPP`            | WhatsApp da Mi em E.164       | **sim — sem ela a recuperação não sai do lugar** |
| `AUTH_CANONICAL_HOST`    | `miozorio.com.br`             | recomendado                                      |
| `MI_WHATSAPP_EMERGENCIA` | segundo número da Mi em E.164 | opcional                                         |
| `AUTH_EXTRA_ORIGINS`     | vazio                         | só se surgir domínio novo                        |
| `AUTH_COOKIE_DOMAIN`     | vazio                         | só se um dia houver subdomínio                   |

⚠️ **`MI_WHATSAPP` passa a ser lida pela primeira vez aqui.** Ela já existia no
`.env.example`, mas nenhum código no portal a lia — então ninguém nunca notou se
estava vazia no Dokploy. A partir do B2 ela é o destino do código de
recuperação: vazia ou malformada, `numerosDaMi()` devolve lista vazia, o pedido
fica gravado com `notify_error` e a pessoa lê _"a Mi vai te mandar o código"_
enquanto o código não vai a lugar nenhum. **Confira antes do deploy** — é o
único jeito de esse modo de falha não chegar calado na cliente.

⚠️ **Cuidado com o nome.** Existem duas envs diferentes, com os nomes
trocados de posição, e as duas guardam o número da Mi:

| Env           | De quem é       | Formato        | Se faltar                             |
| ------------- | --------------- | -------------- | ------------------------------------- |
| `MI_WHATSAPP` | auth (B2)       | E.164 (`+55…`) | **falha silenciosa** — código não sai |
| `WHATSAPP_MI` | agenda (A1–A11) | URL do `wa.me` | cai num número fixo no código         |

`AUTH_CANONICAL_HOST` vazio faz o portal usar o host de `NEXT_PUBLIC_SITE_URL`.
Se algum dia o redirect entrar em laço (Traefik reescrevendo o Host), colocar o
valor `off` desliga **sem precisar de deploy**.

### 2. Traefik → domínio canônico

⚠️ **Infra compartilhada — precisa do OK do Rodolfo antes de mexer.**

O portal já redireciona `www` → apex sozinho. Fazer o mesmo no Traefik só
economiza um salto: no router do `portal-miozorio`, adicionar um middleware
`redirectRegex` de `^https://www\.miozorio\.com\.br/(.*)` para
`https://miozorio.com.br/$1`, permanente.

**O domínio de preview do Dokploy (`*.traefik.me`) não é para uso das
clientes** — ele fica de fora do redirect de propósito, mas quem entrar por lá
tem sessão separada. Divulgar só `miozorio.com.br`.

### 3. Evolution API

Nada novo para instalar: a recuperação usa o mesmo caminho de saída das outras
mensagens (`whatsapp_message`, com retry e status). Só confirmar que a instância
`evo-miozorio` está conectada. Se estiver fora, o pedido não se perde — aparece
em _Configurações → Acessos_ com o motivo.

### 4. n8n

Nada a fazer. A decisão anterior continua valendo: o app fala direto com a
Evolution, sem workflow intermediário.

### 5. Resend (e-mail)

`RESEND_API_KEY` / `EMAIL_FROM` agora servem **apenas** ao aviso "sua senha foi
alterada". O reset por link de e-mail saiu de cena.

⚠️ **Atenção:** a rota `/admin/redefinir/<token>` não existe mais. Se houver um
e-mail antigo de reset em algum lugar, o link dá 404 — o caminho é
`/admin/recuperar`.

### 6. Ordem do deploy

> O roteiro completo, com backup e rollback, é o
> `docs/DEPLOY-AUTH-B1-B5.md`. O resumo abaixo é só para situar.

1. `merge` na master → `scripts/deploy-agenda.sh` (ele faz backup verificado,
   pré-voo e conferência; `application.deploy` cru pula tudo isso);
2. o entrypoint roda as migrations sozinho. **As duas desta frente são
   aditivas** — nada é apagado, ninguém é deslogado. ⚠️ Mas o deploy carrega
   **quatro frentes e 10 migrations**, e a `20260913080000_professional_obrigatorio`
   (da #106) **aborta de propósito** se achar double-booking preexistente;
3. conferir `https://miozorio.com.br/api/health`;
4. abrir `https://www.miozorio.com.br/clube/entrar` e confirmar que cai no apex;
5. fazer um pedido de código de teste e ver a mensagem chegar no WhatsApp da Mi.

---

## Decisões que dependem da Mi

1. **Validade do código** — está em 60 min. Ela pode mudar em _Configurações_
   (mínimo 15). 60 min foi escolhido porque o repasse é manual.
2. **Contato de emergência — ✅ DECIDIDO (13/09/2026): existe.** O Rodolfo
   configura `MI_WHATSAPP_EMERGENCIA` no Dokploy; o código passa a sair para os
   dois números ao mesmo tempo. Sem mudança de código.
3. **Tempo de sessão** — cliente 30 dias, painel 7 dias. O painel era 12h e a Mi
   caía no meio do atendimento; 7 dias é o teto sugerido para acesso ao painel.
4. **Mensagem de login da cliente** — hoje ela diz _"Não encontrei esse telefone
   por aqui"_, o que é muito mais gentil, mas confirma para quem perguntar que
   aquele número **não** tem conta. A recuperação de senha é neutra no
   **texto** dos dois passos — ver _Limites conhecidos_ abaixo para o que
   ainda escapa. Se a Mi preferir privacidade máxima, a mensagem volta a ser
   única ("Telefone ou senha incorretos") — é trocar uma linha.
5. **Primeiro acesso — ✅ DECIDIDO (13/09/2026): fica como está.** A senha
   inicial da cliente continua sendo o próprio telefone, e a tela de login
   continua dizendo isso.

   **Risco aceito, de olhos abertos:** enquanto uma cliente nova não faz o
   primeiro acesso, quem souber o telefone dela pode entrar e definir a senha
   no lugar dela — tomando a conta. Ela não perde dado (a troca obrigatória
   barra todas as páginas antes disso: `s.prov` redireciona para
   `/clube/conta/senha`), mas fica trancada para fora e precisa da Mi para
   recuperar. A janela é estreita — só entre entrar no Clube e o primeiro
   login; quem já tem senha própria não é afetada.

   O ganho que pesou mais: a cliente leiga entra sozinha, sem depender da Mi.
   Se um dia isso incomodar, o conserto já está pronto e é pequeno — basta o
   primeiro acesso usar o mesmo código da Mi do B2 (o módulo
   `src/lib/recuperacao.ts` já serve os dois perfis) e desligar o ramo
   `provisoria` em `loginCliente`.

---

## Limites conhecidos (revisão adversarial de 15/09/2026)

Uma revisão com sete lentes independentes sobre o código de auth achou 20
pontos; 13 viraram conserto (na PR #107). Estes **não** foram corrigidos — por
decisão ou por escopo — e ficam aqui para ninguém redescobrir:

1. **Enumeração residual pela recuperação.** O texto é neutro nos dois passos,
   mas (a) o passo 1 demora mais quando a conta existe — é o tempo de avisar a
   Mi pela Evolution, que é síncrono; (b) com um código ativo, o contador
   "você ainda pode tentar N vezes" confirma que existe conta. Os dois só
   importam se a enumeração pelo login (decisão 4, aceita) um dia for
   revertida; aí o conserto é enfileirar o aviso à Mi sem esperar a resposta e
   tirar o contador da mensagem.
2. **Sessão do painel derrubada "de verdade" só em carregamento completo.**
   Trocar a senha sobe `tokenVersion`, mas o middleware só valida a assinatura
   do JWT (roda no Edge, sem banco) e a conferência no banco vive no
   `admin/layout.tsx` — que o App Router **não** re-renderiza em navegação
   interna (`<Link>`). Das 34 páginas do painel, só 7 chamam `requireAdmin`.
   Quem estiver com uma sessão aberta continua navegando entre as outras 27
   até recarregar a página ou o JWT vencer (7 dias). `template.tsx` não
   resolve: é uma prop que o roteador do cliente reaproveita, não roda de novo
   no servidor. **Precisa de decisão** — as duas saídas reais estão no
   `docs/DEBITOS.md`.
3. **Trocar a senha logada não pede a senha atual.** Foi assim de propósito
   (cliente leiga, fluxo curto). Consequência: aparelho destravado por um
   minuto = senha trocada e a dona deslogada dos outros aparelhos. Se
   incomodar, é pedir a senha atual no `SenhaForm` quando `provisoria=false`.
4. **Hora de "vale até / venceu às" está no fuso das Configurações da Mi**,
   sem indicação de fuso. Cliente em Manaus lê uma hora que não é a dela.
5. **Rajada distribuída de pedidos de código.** O teto por IP (10/h) segura
   uma origem só; N origens ainda somam N×10 mensagens/hora no WhatsApp da Mi.
   Fechar isso exige guarda no banco (índice único parcial em
   `password_recoveries` por pessoa com `used_at IS NULL`) — migration, fora
   deste PR.

## Verificação (13/09/2026)

Rodado num ambiente completo: PostgreSQL 16 com **todas as migrations
aplicadas do zero**, build de produção (`output: standalone`), Evolution API
falsa gravando o que a Mi receberia, e um Chromium de verdade dirigindo as
telas.

**Automatizado:** `tsc --noEmit` 0 erros · `next lint` 0 · **360 testes** em 35
arquivos, entre eles dois novos com Prisma/cookies/Evolution falsos:
`tests/recuperacao-ciclo.test.ts` (o ciclo do código ponta a ponta) e
`tests/login-cliente.test.ts` (login, limites e sessão).

> Esse 360 é o retrato **daquele dia, neste branch antes do merge** — está aqui
> como registro, não como número atual. Depois do merge com a master, das
> frentes que entraram em seguida (#103, #105, #106) e da revisão adversarial
> de 15/09 (#107), a suíte está em **512 testes / 46 arquivos**. Se você rodar
> `npm test` hoje e vir 512, é isso: não há teste faltando.

**Checklist funcional no navegador — 30 de 30 ✅**

| #   | Cenário                                                    | Evidência                                                                                                                 |
| --- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| 1   | Login em Chrome desktop, Safari iOS e Chrome Android       | os três caem em `/clube/conta`                                                                                            |
| 2   | Webview do Instagram: entra e a sessão persiste ao navegar | cookie `HttpOnly` + `SameSite=Lax` + `Path=/`                                                                             |
| 3   | `www` → apex                                               | 308 para `https://miozorio.com.br/...` com caminho e query preservados; apex, `*.traefik.me` e localhost não redirecionam |
| 4   | Telefone em formato diferente do cadastrado                | `+55 21 …`, `5521…` e `21 99862 6845` entram                                                                              |
| 5   | Senha errada                                               | "Senha incorreta…" sem travar; telefone desconhecido convida a se cadastrar                                               |
| 6   | Cliente pede código                                        | a Mi recebe no número dela com código e dados; a cliente vê a orientação, o botão "Chamar a Mi" e o reenvio com cooldown  |
| 7   | A Mi repassa 40 min depois                                 | código aceito                                                                                                             |
| 8   | Demora na tela da senha (código já vencido)                | **salva e entra** — a mensagem do print não aparece mais                                                                  |
| 9   | Código com 70 min                                          | "Seu código venceu às 23:30. Peça um novo 💛" + botão ali mesmo                                                           |
| 10  | A Mi gera código pela ficha                                | código na tela + link `wa.me` da cliente; o mesmo código vale no site                                                     |
| 11  | A Mi esquece a própria senha                               | código no WhatsApp dela, troca e entra no painel                                                                          |
| 12  | Número não cadastrado pede código                          | mensagem neutra, nada enviado, nada gravado                                                                               |
| 13  | Troca de senha derruba as outras sessões                   | painel e cliente: a sessão antiga volta para o login                                                                      |
| 14  | 375px nas quatro telas de auth                             | sem rolagem lateral; botão principal com 48–52px de alvo; "mostrar senha" funciona                                        |
| 15  | Abrir página protegida sem sessão                          | login com `callbackUrl` e volta para a página original                                                                    |

**Repetição do caso real (3.3):** pedir → a Mi repassa depois → "Código
confirmado 💛" → demora na tela da senha → salvar. Entra direto, e a senha nova
funciona num segundo navegador.

**Dois problemas que só apareceram aqui e já estão corrigidos:**

1. Sessão derrubada no painel mostrava **tela de erro** em vez de voltar ao
   login. O middleware roda no Edge e não consegue perguntar ao banco se a
   senha mudou; a conferência passou para o layout do `/admin`, que redireciona
   para o login (com `callbackUrl`) em vez de deixar a página estourar.
2. Depois de salvar a senha nova, a cliente às vezes ficava na mesma tela
   **mesmo tendo salvado** — a navegação dependia de um efeito no navegador.
   Agora quem navega é o redirect do servidor, igual ao login.

**O que este ambiente não cobre** (fica para o aceite manual do Rodolfo):
aparelho real com Face ID/biometria (WebAuthn não roda em CI), o WhatsApp da
Evolution de produção e o Traefik com os domínios reais.
