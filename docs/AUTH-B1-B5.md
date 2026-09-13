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

| Variável                 | Valor                         | Precisa?                       |
| ------------------------ | ----------------------------- | ------------------------------ |
| `AUTH_CANONICAL_HOST`    | `miozorio.com.br`             | recomendado                    |
| `MI_WHATSAPP_EMERGENCIA` | segundo número da Mi em E.164 | opcional                       |
| `AUTH_EXTRA_ORIGINS`     | vazio                         | só se surgir domínio novo      |
| `AUTH_COOKIE_DOMAIN`     | vazio                         | só se um dia houver subdomínio |

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

1. `merge` na master → `application.deploy` no Dokploy;
2. o entrypoint roda as migrations sozinho (as duas são aditivas: nada é
   apagado, ninguém é deslogado);
3. conferir `https://miozorio.com.br/api/health`;
4. abrir `https://www.miozorio.com.br/clube/entrar` e confirmar que cai no apex;
5. fazer um pedido de código de teste e ver a mensagem chegar no WhatsApp da Mi.

---

## Decisões que dependem da Mi

1. **Validade do código** — está em 60 min. Ela pode mudar em _Configurações_
   (mínimo 15). 60 min foi escolhido porque o repasse é manual.
2. **Contato de emergência** — qual segundo número usar quando o WhatsApp
   principal estiver fora do ar (`MI_WHATSAPP_EMERGENCIA`). Hoje está vazio.
3. **Tempo de sessão** — cliente 30 dias, painel 7 dias. O painel era 12h e a Mi
   caía no meio do atendimento; 7 dias é o teto sugerido para acesso ao painel.
4. **Mensagem de login da cliente** — hoje ela diz _"Não encontrei esse telefone
   por aqui"_, o que é muito mais gentil, mas confirma para quem perguntar que
   aquele número **não** tem conta. A recuperação de senha continua 100%
   neutra. Se a Mi preferir privacidade máxima, a mensagem volta a ser única
   ("Telefone ou senha incorretos") — é trocar uma linha.
5. **Primeiro acesso** — a tela de login ainda diz "no primeiro acesso, sua
   senha é o seu próprio telefone". É a dica que mais ajuda a cliente leiga e a
   que mais entrega informação para fora. Manter?
