# Ativar a cobrança do sinal por PIX (Mercado Pago)

> Faça isto **depois** do deploy, com o app já no ar e saudável. Enquanto as
> três variáveis estiverem vazias o portal funciona normalmente — reserva
> guardada e sinal combinado no WhatsApp da Mi.

⚠️ **Nenhuma destas chaves pode ser colada num chat, num commit ou num
documento** (R9). Elas vão direto do painel do Mercado Pago para o Dokploy.

---

## 1. Pegar as credenciais no Mercado Pago

Entre em https://www.mercadopago.com.br/developers/panel **com a conta da Mi**
(a que recebe o dinheiro — não uma conta de teste).

**a) Access token de produção**
Aplicações → sua aplicação → *Credenciais de produção* → copie o
**Access Token**. Começa com `APP_USR-`.

> Se ainda não existir aplicação, crie uma: produto "Pagamentos online",
> modelo de integração "CheckoutAPI". O PIX vem junto.

**b) Assinatura secreta do webhook**
Na mesma aplicação → *Webhooks* → *Configurar notificações* → copie a
**assinatura secreta**.

> Esta é a que impede alguém de dizer ao portal que uma reserva foi paga. Sem
> ela o webhook **recusa tudo**, de propósito.

---

## 2. Cadastrar o webhook

Ainda em *Webhooks*, cadastre a URL de produção:

```
https://miozorio.com.br/api/webhooks/pagamento
```

Marque **apenas** o evento **`payment`** (Pagamentos). Os outros não são usados
e só gerariam ruído.

---

## 3. Colocar as variáveis no Dokploy

Aplicação `portal-miozorio` → *Environment* → adicione as três:

```
PAGAMENTO_PROVIDER=mercadopago
MP_ACCESS_TOKEN=APP_USR-...          ← do passo 1a
MP_WEBHOOK_SECRET=...                ← do passo 1b
```

Salve e **redeploy** (a aplicação precisa reiniciar para ler as variáveis).

> Se faltar qualquer uma das três, `gatewayAtivo()` devolve `null` e o portal
> volta sozinho ao caminho do WhatsApp. Meia configuração não gera tela
> quebrada para a cliente.

---

## 4. Agendar o cron de conciliação

Dokploy → *Schedules* → nova tarefa, **a cada 10 minutos**:

```bash
curl -fsS -X POST https://miozorio.com.br/api/cron/conciliar-sinais \
  -H "Authorization: Bearer $CRON_SECRET"
```

**Este passo não é opcional.** Webhook se perde — entrega falha, deploy no
meio, instabilidade do provedor. Sem o cron, uma cliente que **pagou** ficaria
"aguardando sinal" até o horário vencer, que é o pior desfecho possível porque
o dinheiro já entrou. O cron pergunta ao Mercado Pago e fecha o caso.

---

## 5. Testar com dinheiro de verdade (R$ 1)

Não dá para testar isto de mentira: credencial de produção só aceita PIX real.

1. Em `/admin/serviços`, ligue **"Exige sinal"** num serviço barato.
2. Pelo site, agende esse serviço com o **seu** telefone.
3. A tela deve mostrar **"Seu horário está guardado"** com o valor do sinal
   (20% do preço) e o botão **"Pagar sinal por PIX"**.
4. Clique: aparece o QR e o código copia-e-cola.
5. Pague pelo app do banco.
6. **Em alguns segundos a própria tela deve confirmar sozinha** — é o poll
   perguntando ao portal se o pagamento caiu.
7. Confira que a Mi recebeu "💰 Sinal recebido" no WhatsApp.
8. Desligue "Exige sinal" do serviço de teste e cancele o agendamento.

### Se o passo 6 não acontecer

Não significa que o dinheiro sumiu. Na ordem:

| Verificar | Onde |
|---|---|
| A cobrança existe? | `select deposit_provider, deposit_payment_id, deposit_paid_at from bookings order by created_at desc limit 1;` |
| O webhook chegou? | Mercado Pago → Webhooks → histórico de entregas |
| A assinatura bate? | Se o MP mostra entrega com resposta **401**, `MP_WEBHOOK_SECRET` está errada |
| O cron pega? | Rode à mão o `curl` do passo 4 — ele deve confirmar o pagamento |

O cron é a rede de segurança: mesmo com o webhook quebrado, em até 10 minutos
o pagamento é reconhecido.

---

## Voltar atrás

Apague `PAGAMENTO_PROVIDER` no Dokploy e redeploy. O portal volta ao fluxo do
WhatsApp na hora, sem tocar em código. Cobranças já pagas continuam registradas.

## Trocar para Efí depois

É escrever `src/lib/pagamento/efi.ts` com a mesma interface de
`src/lib/pagamento/tipos.ts` e apontar `index.ts`. O fluxo de agendamento não
muda — foi desenhado assim justamente para a decisão não ficar presa.
