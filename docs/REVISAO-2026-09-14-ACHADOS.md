# Achados da revisão de 14/09/2026 — o que ficou de fora do PR #108

Duas revisões rodaram sobre o diff do PR #108 antes do merge: uma de segurança e
uma de correção. Este documento existe porque a segunda **varreu muito mais do
que o diff** e achou coisas pré-existentes que não cabiam naquele PR — e que se
perderiam se ninguém as escrevesse.

## ⚠️ Leia isto antes de acreditar em qualquer item abaixo

**O escopo da revisão de correção estava errado.** Ela comparou contra o `master`
**local**, que estava parado 40 commits atrás do `origin/master`. Em vez do meu
diff (8 commits, 21 arquivos), varreu 48 commits e 122 arquivos — os PRs
#103 a #106 junto com o meu. Conferi arquivo por arquivo: **nenhum achado caía em
linha escrita no #108.**

E ela rodou em **passada única, sem agente de verificação independente** — a
própria revisão registrou que os itens 8, 11, 13 e 14 abaixo são os que ela mais
gostaria que um segundo leitor conferisse.

Por isso, a separação que importa:

| | Verifiquei eu mesmo? | O que fiz |
|---|---|---|
| 2 itens | ✅ sim, lendo o código | um consertado no #108, um registrado como dívida |
| 13 itens | ❌ **não** | só registrados abaixo, como PISTAS |

**Os 13 de baixo são pistas, não bugs confirmados.** Tratar um deles como fato
sem reproduzir é o mesmo erro que a dívida do `IndicarForm` cometeu — ela
afirmava algo que o código não fazia, e alguém ia caçar um bug inexistente.

---

## Os dois que eu verifiquei

**"Não" na alergia era tratado como dado de saúde** — ✅ **consertado no #108.**
Duas definições de "alergia de verdade" no repositório discordavam, e a cliente
que respondia "Não" não conseguia agendar. Detalhes em `docs/DEBITOS.md`.

**`POST /api/bookings/[id]/sinal` não checa dono** — 📌 **registrado como dívida
aberta**, não consertado. Mesma classe de IDOR que o #108 fechou no `/confirm`.
Inerte enquanto o PIX estiver desligado; **ligar o gateway acorda o buraco.**
Detalhes e o porquê de não ter ido junto: `docs/DEBITOS.md`.

---

## As 13 pistas — NÃO verificadas

Ordenadas pelo que me pareceu mais grave **se** for verdade. Cada uma precisa ser
reproduzida antes de virar trabalho.

### 1. Sinal pago pode perder o horário em silêncio
`src/lib/booking-service.ts` — `expireStaleHolds`

A alegação: a função cancela pendentes por `holdExpiresAt` vencido **sem excluir
quem já pagou o sinal**. Com gateway ativo, o PIX é emitido com prazo
deliberadamente maior que o hold (`Math.max(5, …)` em `sinal/route.ts`); quem
paga no fim da janela teria `depositPaidAt` gravado, `confirmBooking` recusaria
por `hold_expired`, e a varredura seguinte cancelaria a reserva avisando a Mi que
"expirou". Dinheiro dentro, horário perdido, ninguém alertado.

**É a de maior aposta da lista** — mexe em dinheiro. Também é inerte hoje (sem
gateway), então cai no mesmo pacote da decisão do PIX. **Verificar junto com o
item do `/sinal`.**

### 2. Rate limit de login por identificador usa só os 4 últimos dígitos
`src/lib/cliente-auth.ts`

A alegação: o teto por identificador é chaveado em `maskPhone(phone)` —
`"••••6845"`. Dez falhas de login num número **que nem precisa existir** criariam
linhas com esse identificador, e a cliente real cujo telefone termina nos mesmos
4 dígitos ficaria trancada 15 min, repetidamente. O `auth.ts` do admin passa o
e-mail inteiro, que é o comportamento certo.

Se confirmado, é o mais explorável da lista: qualquer pessoa tranca qualquer
cliente sabendo só o final do telefone dela.

### 3. Foto de celular real estoura o teto de tamanho
`src/components/agendar/AgendarWizard.tsx` · `src/lib/validation.ts`

A alegação: `otimizar()` devolve o arquivo intacto abaixo de 4 MB ou fora de
JPEG, e redimensiona para 4000px — não "1600px" como o comentário do
`FOTO_BASE64_MAX` afirma. Um JPEG de 4,5 MB viraria ~6 MB em base64, acima do
teto de 5,6 MB, e o zod recusaria com 400 — que a tela traduz como *"Confere os
campos? …o e-mail é o mais comum."* Se for verdade, a cliente **nunca** consegue
agendar serviço com variação de tamanho, e é mandada conferir o e-mail.

### 4. Serviço arquivado bloqueia recriar pelo mesmo nome
`src/app/admin/actions.ts` — checagem de nome duplicado (A6)

A alegação: a consulta não filtra `archivedAt: null`, então arquivar "Buço" e
depois recriá-lo falha apontando para um registro que a Mi **não vê em tela
nenhuma**. Conserto sugerido: `archivedAt: null` no `where`.

### 5. Tamanho aprovado em reserva cancelada
`src/lib/booking-service.ts` — `validarTamanho` · `src/app/admin/page.tsx`

A alegação: `validarTamanho` não olha `status`, e o card renderiza "Aprovar
tamanho"/"Ajustar" só com base em `aguardandoValidacaoTamanho(b)`. Uma reserva
cancelada poderia ser reprecificada e ter `endsAt` reescrito — e a cliente
receberia WhatsApp com preço novo de um atendimento que não existe mais. A trava
`no_overlap` é parcial (R21), então não dispara.

### 6. Variação desativada não pode ser re-adicionada
`src/app/admin/actions.ts` — `adminAddVariante`

Mesma forma do item 4, para tamanhos: a checagem de duplicado carrega variantes
sem filtrar `active`, e `sort: variants.length` contaria as inativas, abrindo
buracos na ordenação visível.

### 7. Toast de confirmação pisca e desaparece
`src/components/admin/Toast.tsx`

A alegação: o componente limpa `?ok=` da URL no mesmo efeito que mostra a
mensagem, e o guard de render lê o search param — então a confirmação sai da tela
assim que a navegação suave commita, muito antes dos 5 s. O "piscar" que o
componente foi escrito para consertar continuaria lá. Conserto sugerido: capturar
a mensagem em estado na primeira leitura.

### 8. Template de confirmação com placeholders sem dado
`src/app/admin/actions.ts` · `src/lib/notify.ts`

A alegação: o template ganhou `{local}` e `{valor}`, mas o disparo do encaixe
manual (e a pré-visualização do admin) passam só `nome`/`servico`/`inicio` — a
cliente receberia a mensagem com três linhas vazias, sem endereço nem preço. E a
pré-visualização deixaria de bater com o que é enviado de fato, quebrando a
invariante de "fonte única" daquela função.

### 9. Notificação de reserva com tamanho **e** sinal só fala do tamanho
`src/lib/booking-service.ts` — ternário do `notificarMi`

A alegação: o ramo da variação ganha a disputa, então uma reserva que precisa de
validação de tamanho **e** de sinal (cliente reincidente) nunca avisa a Mi do
sinal pendente nem do prazo mais curto. Ela aprova o tamanho, não cobra o sinal,
e o cron expira o horário.

### 10. Forms aninhados na recuperação de senha
`src/components/auth/RecuperarFluxo.tsx`

A alegação: o botão "Pedir novo código" renderiza um `<form>` **dentro** do form
de verificar e do de salvar. HTML aninhado assim é descartado pelo parser: sem
JS, o botão viraria submit do form externo. Existe um botão solto no arquivo que
já faz certo — é o padrão a copiar.

### 11. Dedupe de serviços não move variações nem foto
`scripts/dedup-servicos.ts`

A alegação: a transação re-aponta bookings e itens, mas não `service_variants`
nem `mediaAssetId`. Uma reserva movida ficaria com `variantId` de um serviço
arquivado, e `validarTamanho` não acharia a variação — a Mi nunca conseguiria
aprovar aquele tamanho. A foto de exemplo se perderia em silêncio.

⚠️ Este script **altera dados** e é gate de OK explícito (`claude.md`). Se for
usá-lo, verifique este item **antes**.

### 12. `caminhoSeguro` compara caminho por igualdade exata
`src/lib/auth-rotas.ts`

A alegação: a lista de caminhos proibidos é comparada por igualdade, então
`/clube/entrar/` (com barra no fim) passaria como `callbackUrl` e criaria um laço
login → login. Conserto sugerido: normalizar barra final e caixa, ou comparar por
prefixo.

### 13. Preview de foto não libera o object URL
`src/components/agendar/AgendarWizard.tsx`

A alegação: cada escolha de arquivo cria um `URL.createObjectURL` e nunca o
revoga, prendendo o arquivo inteiro em memória. Em celular de entrada, trocar a
foto algumas vezes acumularia vários MB. O `dimensoes()` em `imagem-client.ts`
revoga corretamente — é o padrão a copiar.

---

## O que a revisão NÃO olhou

- `docs/**` (~2,5k linhas) e os scripts de QA/deploy: lidos só como contexto.
- As migrations foram lidas e a revisão não achou nada — registrou que a
  `20260913080000_professional_obrigatorio` é "notavelmente cuidadosa".

## Sugestão de encaminhamento

Nada aqui é urgente o bastante para atrasar o #108, e nada deve virar trabalho
antes de ser reproduzido. Se for atacar, os itens **1 e 2** são os que valem o
tempo primeiro: o 1 mexe em dinheiro, o 2 é o mais explorável. Os itens 1 e o do
`/sinal` (em `DEBITOS.md`) pertencem ao mesmo pacote da decisão do gateway PIX.
