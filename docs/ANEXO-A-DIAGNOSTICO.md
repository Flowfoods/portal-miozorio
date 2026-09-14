# Anexo A — o que trava cada pendência (14/09/2026)

Diagnóstico, não mudança. Para cada item: **o que o portal faz hoje** na
ausência da decisão, **o que está bloqueado de verdade** e **quem destrava**.

A conclusão curta: de sete itens, **um único está bloqueado por código** (o
adaptador da Efí), **um não está bloqueado por nada** (a janela de dias de
semana já existe e é configuração), e o resto espera número ou arquivo da Mi.

---

## 1. Preços e durações da linha dia a dia

**Hoje:** sete serviços estão com `pending_price` (escova, cronograma capilar,
reconstrução, hidratação, design de sobrancelha, brow lamination e afins). Eles
**continuam agendáveis** — a cliente vê **"sob consulta"** no card e
**"valor sob consulta"** na barra de resumo, escolhe o horário e conclui.

**O que isso custa, de verdade:** ela marca sem saber quanto vai pagar, e o
valor aparece depois, pela Mi. Para um serviço de R$60 isso é atrito pequeno;
num de R$250 é a diferença entre confirmar e sumir. Não é bug — é uma decisão
de produto tomada por omissão.

**Efeito colateral que liga este item ao item 7:** `assertSinalCoerente`
(`admin/actions.ts`) proíbe um serviço com preço a confirmar de exigir sinal —
o sinal é uma porcentagem do valor, e não existe porcentagem de "sob consulta".
**Enquanto o preço não existir, esses sete serviços não podem exigir sinal**,
por construção.

**Destrava:** a Mi dizer os números. Nada de código: preço e duração são
editáveis em `/admin/servicos`, sem deploy.

---

## 2. Janela própria em dias de semana

**Não está bloqueado.** Isto já existe e está no ar.

`service_availability` guarda os dias por serviço (Luxon 1=seg…7=dom) e a API
devolve `availableWeekdays`. Quando o serviço não declara dias próprios, vale a
regra padrão do wizard: **curso = qualquer dia; o resto = fim de semana**.

**Destrava:** a Mi marcar os dias de cada serviço da linha dia a dia no admin.
É configuração, não desenvolvimento — e, como está no banco, vale na hora, sem
deploy.

---

## 3. Pacote de fotos e logo vetorial

**Hoje:** `public/` está vazio; as imagens vivem em `MEDIA_DIR` (volume
persistente) e são servidas por `/media/...`, com upload pelo admin. O portal
não quebra sem elas — degrada.

**Destrava:** os arquivos. É o item mais "só falta o material" da lista, e o de
maior efeito visual por hora de trabalho: a R12 descreve uma marca que se
sustenta em foto grande e tipografia, e nenhuma linha de código substitui a
foto.

---

## 4. Depoimentos reais com autorização de nome

**Hoje:** o modelo `Testimonial` é completo — `quote`, `author`, `rating`,
`status` (rascunho → pendente → aprovado → rejeitado → arquivado) e vínculo
opcional com a cliente e o atendimento. A coleta pela Área da Cliente (F1) já
existe.

**Não depende de uma decisão única.** Depende de rodar o pós-atendimento que a
skill descreve (pedido de avaliação + autorização de foto) e ir aprovando o que
chegar. É acúmulo, não decisão.

**Destrava:** ligar o pós-atendimento e esperar. Quem aprova é a Mi, no admin.

---

## 5. Pendências de auth (`docs/AUTH-B1-B5.md`)

Validade do código de recuperação e tempo de sessão. **Números, não código** —
as constantes existem e estão documentadas. Vale revisar junto com a Mi o que
ela sente na prática (código que vence antes de ela repassar é queixa real).

---

## 6. Gateway PIX — Mercado Pago × Efí

**Hoje:** `gatewayAtivo()` só conhece `"mercadopago"`, e só devolve um gateway
se `PAGAMENTO_PROVIDER=mercadopago` **e** `MP_ACCESS_TOKEN` existir. Sem isso
devolve `null` e o portal segue no caminho do WhatsApp (R22) — que é o
comportamento atual e funciona.

**Este é o único item com trabalho de código pendente, e só num dos caminhos:**

- **Mercado Pago:** zero código. O adaptador está pronto e desligado. Ligar é
  decisão + credenciais + as duas envs (`docs/agenda/ATIVAR-PIX-MERCADOPAGO.md`).
- **Efí:** arquivo novo `src/lib/pagamento/efi.ts` com a mesma interface de
  `tipos.ts`, mais o `gatewayAtivo()` aprendendo o provedor novo.

**Destrava:** a escolha. Escrever os dois adaptadores antes de decidir é
trabalho que vai para o lixo — por isso não escrevi.

---

## 7. Quais serviços exigem sinal

**Hoje:** a migration desligou `requires_deposit` em **todos** os serviços.
Ninguém paga sinal por causa do serviço que escolheu.

**O que continua funcionando sozinho:** a regra de reincidência. Três
cancelamentos levam `customer.requiresDeposit` a `true` (`policies.ts`), e daí
a reserva **nasce aguardando sinal** independentemente da flag do serviço. Ou
seja, a proteção contra quem desmarca demais está de pé mesmo com tudo
desligado.

**E sem gateway?** A reserva com sinal fica `pending` com prazo próprio, a tela
cai no caminho do WhatsApp e quem fecha é a Mi. O beco sem saída que o A7
corrigiu não voltou.

**Destrava:** a Mi dizer quais serviços valem sinal — **depois** de o item 1
ter preço, porque `assertSinalCoerente` recusa a combinação preço pendente +
sinal.

---

## Ordem que eu sugeriria

1. **Preços** (item 1) — destrava o item 7 e tira o "sob consulta" da tela de
   quem está decidindo se marca.
2. **Dias da linha dia a dia** (item 2) — dez minutos no admin, sem deploy.
3. **Fotos** (item 3) — maior efeito visual por hora investida.
4. **Gateway** (item 6) — só quando o sinal for realmente cobrar alguém.

Depoimentos e as pendências de auth caminham junto, sem bloquear ninguém.
