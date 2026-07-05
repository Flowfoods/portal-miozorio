# Autenticação — Diagnóstico (FASE 0)

> Auditoria do que **já existe** antes de qualquer código novo. Regra do projeto:
> o repositório costuma estar à frente do prompt — medir antes de construir.
> Decisão de provedor de e-mail tomada. **Zero mudança de comportamento nesta fase.**

## Resumo executivo

A base de autenticação está **madura**. Praticamente toda a FASE 1 (server-side) e a
FASE 2.1 (reset do admin por e-mail) **já estão implementadas e em produção**. O que
falta se concentra em: (a) **UX dos formulários** (ver senha, caps lock, medidor de
força), (b) **auditoria** (`AuthLog`), (c) **um buraco real e crítico**: a cliente que
já trocou a senha provisória e **esquece** não tem como recuperar — hoje só a Mi
resolve manualmente. É a maior prioridade de valor.

---

## 1. Admin — Painel da Mi (NextAuth)

**Arquivos:** `src/lib/auth.ts`, `src/lib/security.ts`, `src/lib/email.ts`,
`src/app/admin/reset-actions.ts`, `src/app/admin/login/page.tsx`,
`src/app/admin/recuperar/page.tsx`, `src/app/admin/redefinir/[token]/`.

| Item | Estado | Observação |
|---|---|---|
| Provider | ✅ | `CredentialsProvider` e-mail+senha contra `admin_users` |
| Hashing | ✅ | **bcryptjs**, `hashSync(…, 12)` (não é fraco — R4 ok) |
| Sessão | ✅ | JWT, `maxAge` 12h (admin curto) |
| Lockout por conta | ✅ | `failedAttempts`+`lockedUntil`, backoff exponencial 5→1min…teto 30min (`lockoutMs`) |
| Erro genérico (server) | ✅ | `authorize` devolve `null` sem distinguir "não existe" de "senha errada" |
| Reset por e-mail | ✅ | `/admin/recuperar` → e-mail Resend → `/admin/redefinir/[token]` |
| Token de reset | ✅ | 32 bytes, **SHA-256 no banco** (cru só no e-mail), TTL 1h, uso único, invalida anteriores, destrava a conta ao concluir |
| Anti-enumeração no reset | ✅ | resposta sempre neutra + honeypot `site` |
| MIN_SENHA | ✅ | 12 caracteres (`security.ts`) |
| Cabeçalhos de segurança | ✅ | `next.config.mjs`: HSTS, `X-Frame-Options: DENY`, CSP, aplicados em `/(.*)` |
| **Ver/ocultar senha** | ❌ | inputs `type=password` sem toggle |
| **Aviso de Caps Lock** | ❌ | ausente |
| **Medidor de força** (reset) | ❌ | `ResetForm` só valida `minLength` |
| **Feedback com shake/foco** | ❌ | erro é texto simples |
| **Invalidar sessões ao trocar senha** | ❌ | JWT stateless: reset destrava, mas JWTs antigos valem até 12h (falta `tokenVersion`) |
| **AuthLog (auditoria)** | ❌ | não há tabela nem escrita de eventos |
| **Rate limit por IP** | ❌ | só há trava por conta (defesa-em-profundidade faltando) |
| Passkeys / 2FA / sessões ativas / alerta de novo dispositivo | ❌ | FASES 3–4 |

## 2. Cliente — Área do Clube (auth própria)

**Arquivos:** `src/lib/cliente-auth.ts`, `src/components/clube/LoginForm.tsx`,
`src/components/clube/SenhaForm.tsx`, `src/app/(site)/clube/entrar/`,
`src/app/(site)/clube/conta/`.

| Item | Estado | Observação |
|---|---|---|
| Sessão | ✅ | cookie `mi_clube` **httpOnly**, assinado HMAC-SHA256 (`NEXTAUTH_SECRET`), `secure` em prod, `sameSite=lax`, TTL **30 dias** |
| Isolamento | ✅ | só guarda `customerId`; toda query filtra por ele — cliente **nunca** passa id por URL/payload |
| Hashing | ✅ | bcrypt 12 |
| 1º acesso | ✅ | senha provisória = dígitos do telefone; portal **força a troca** antes de liberar dado; consentimento LGPD na 1ª troca |
| Lockout por conta | ✅ | `clubFailedLogins`+`clubLockedUntil`, mesmo backoff |
| Erro genérico | ✅ | "Telefone ou senha incorretos." — não revela existência nem se entrou no clube |
| Nova senha ≠ telefone | ✅ | bloqueia manter o telefone como senha |
| **"Esqueci minha senha"** | ❌ | **🚨 CRÍTICO** — não existe rota. Cliente que trocou a senha e esqueceu fica **travada fora** (só a Mi resolve na mão) |
| **Ver/ocultar senha + Caps Lock** | ❌ | idem admin |
| WhatsApp OTP / link mágico / passkeys / nudge Face ID | ❌ | FASES 2.2, 3, 4.2 |

## 3. Serviços e infraestrutura

- **E-mail transacional:** ✅ **Resend** já implementado (`src/lib/email.ts`, fetch direto
  sem SDK). Envs: `RESEND_API_KEY`, `EMAIL_FROM` (remetente verificado).
  ⚠️ *Operacional:* confirmar que ambas estão no ambiente de prod e o domínio está
  verificado no Resend (senão o reset do admin envia em silêncio e falha no log).
- **WhatsApp:** Evolution API + n8n já usados para lembretes (`NotificationLog`) —
  reaproveitáveis para o OTP de recuperação da cliente (FASE 2.2).
- **WebAuthn / OTP libs:** ❌ nenhuma instalada (`@simplewebauthn/*`, `otplib`…).
- **Rate-limit util / Upstash:** ❌ inexistente. Trava atual é por conta, no Postgres.

## 4. Decisão de provedor de e-mail (aceite da FASE 0)

**Manter Resend** — já está implementado, é o mais simples para Next.js standalone
(fetch direto, sem engordar o bundle), e cobre o reset do admin. Não trocar por SMTP
da Hostinger. Ação operacional (não-código): garantir `RESEND_API_KEY`/`EMAIL_FROM`
em prod e domínio verificado.

## 5. Lacunas priorizadas (o que as próximas fases realmente entregam)

1. **🚨 Recuperação de senha da cliente (FASE 2.2)** — maior valor. Código OTP por
   WhatsApp (Evolution/n8n), validade 10min, 3 tentativas, cooldown 60s de reenvio,
   resposta neutra. Fecha o buraco de cliente travada fora.
2. **UX dos formulários (FASE 1.1)** — ver senha, caps lock, medidor de força no reset,
   erro com shake/foco. Barato, seguro, alto impacto percebido.
3. **Auditoria `AuthLog` (FASE 1.2)** — tabela de eventos (login ok/falha/reset/bloqueio,
   identificador, IP, user-agent, ts), visível para a Mi. Sem PII sensível (nunca senha/token).
4. **Rate-limit por IP (FASE 1.2)** — defesa-em-profundidade além da trava por conta.
5. **Invalidar sessões ao trocar senha** — `tokenVersion` no admin (JWT) e reemissão no cliente.
6. **Passkeys / Face ID (FASE 3)** — `@simplewebauthn`, modelo `Passkey`, adicional (senha continua fallback).
7. **2FA opcional + link mágico + sessões ativas (FASE 4)** — conveniência/camada extra.

## Execução — FASE 1 (fundamentos + UX) ✅

**Base:** branch `feat/auth-evolucao` construída sobre `feat/crm2-f1-eventos` (o
`cliente-auth.ts` já ciente do tracking — evita conflito quando o CRM2 F1 mergear).

**1.1 UX dos formulários** — componente único `components/auth/PasswordField.tsx`
(ver/ocultar senha com alvo ≥44px e aria, aviso de Caps Lock, medidor de força
opcional), aplicado nos 4 forms (login admin, redefinir admin, login cliente,
nova senha cliente). Login admin: mensagem única "E-mail ou senha incorretos.
Tente novamente 🤎" (anti-enumeração), shake no card (`mi-shake`, respeita
reduced-motion), foco de volta no campo, spinner + trava de duplo submit,
`inputmode`/`autocomplete` corretos.

**1.2 Server-side** — modelo `AuthLog` (migration aditiva `20260705140000`,
sem PII: IP hasheado SHA-256, telefone mascarado ••••1234, nunca senha/token) +
`lib/authlog.ts` (best-effort, nunca bloqueia login). Eventos gravados em admin
(`auth.ts`) e cliente (`cliente-auth.ts`): login_ok/fail, locked, throttled,
reset_*, password_changed. **Rate-limit por IP** (defesa-em-profundidade além da
trava por conta) via contagem de falhas recentes por `ip_hash`. **Invalidação de
sessão** do admin por `token_version` no JWT (redefinir a senha sobe a versão e
derruba os JWTs antigos) + e-mail "sua senha foi alterada". Página de auditoria
para a Mi em `/admin/config/acessos`.

**Validação:** tsc 0 · lint 0 · **169 + 9 testes** verdes (novo `tests/authlog.test.ts`)
· build EXIT 0. Cabeçalhos de segurança já existiam (HSTS/X-Frame/CSP) — conferidos.

## Execução — FASE 2 (recuperação de senha real) ✅

**2.1 Admin (e-mail)** — o fluxo já existia; nesta fase: TTL do token **1h → 30min**
(`RESET_TTL_MS`), rejeição de **senha fraca** server-side (`senhaFraca` — lista local
+ só-dígitos/repetição; HIBP fica p/ depois), cópia do e-mail atualizada. Invalidação
de sessão + e-mail "senha alterada" já entraram na F1.

**2.2 Cliente (WhatsApp)** — a maior lacuna, agora fechada. `lib/cliente-recuperacao.ts`:
código de 6 dígitos, **só SHA-256 no banco**, validade 10min, **máx. 3 tentativas**,
reenvio com **cooldown de 60s**, uso único. Resposta **sempre neutra** (não revela se o
número existe). Entre validar o código e trocar a senha há um "vale" curto assinado por
HMAC (cookie httpOnly, path `/clube`, 10min). Ao concluir, a cliente **já entra logada**.
Envio pelo WhatsApp (Evolution) **+ fallback por e-mail** se houver e-mail. Rate-limit por
IP também nos pedidos de código. Modelo `ClubPasswordReset` (migration aditiva `20260705180000`).
UI mobile-first em `/clube/recuperar` (stepper telefone → código → senha, `RecuperarForm`)
+ link "Esqueci minha senha" de volta no login.

**2.3 Workflow n8n** — **decisão:** o código reusa o **envio direto na Evolution**
(`sendEvolutionText`, a mesma fonte única do resto das notificações do app), env-gated e
best-effort. Não foi criado um workflow n8n intermediário `auth.codigo_recuperacao`: seria
uma camada a mais sem ganho (o app já fala TLS direto com a Evolution). Se um dia a Mi
quiser template/retry no n8n, o webhook pode envelopar `sendEvolutionText` sem tocar na lib.

**Preservação:** o 1º acesso da cliente (senha = telefone + troca forçada) segue **intacto** —
tudo aqui é adição. O forçar-troca é mais seguro que só "nudge", então foi mantido.

**Validação:** tsc 0 · lint 0 · build EXIT 0 · testes verdes.

## Execução — FASE 3 (Passkeys / Face ID / biometria) ✅

WebAuthn com `@simplewebauthn/server@13` + `browser@13`. Modelo único `Passkey`
(migration `20260705190000`) servindo os dois portais via `area`+`subjectId`.
`lib/webauthn.ts`: rpID/origin derivados do host do request (prod e localhost),
challenge em cookie httpOnly assinado (HMAC, 5min), helpers base64url e userHandle
`area:subjectId` (login discoverable/usernameless).

**Rotas** `/api/auth/passkey/{register,authenticate}/{options,verify}`. Cadastro
exige sessão (`sujeitoAtual` — subjectId sempre da sessão, nunca do request).
Login da **cliente** pela rota verify (sessão via cookie); login do **admin** pelo
provider **`passkey`** do NextAuth (mantém o token_version/invalidação). Contador
de assinatura atualizado a cada uso (anti-clonagem). Gerência (ativar/listar/
renomear/remover) em Configurações (admin) e Meu perfil (cliente); trocar senha
**não** remove passkeys (avisado na UI). Botão "Entrar com Face ID/biometria" nas
duas telas de login (some se o navegador não suporta). **Senha continua como fallback.**

**Nota de segurança:** o challenge é de uso único no fluxo da cliente (a rota o
limpa). No login do admin (provider NextAuth, que não escreve cookies) a proteção
contra replay vem do contador + TTL curto do challenge (5min); autenticadores que
não incrementam contador têm essa janela — aceitável para um recurso adicional com
senha de fallback. **Verificação em dispositivo real (Face ID no iPhone, biometria
Android/desktop) é aceite manual do Rodolfo** (não dá para exercitar WebAuthn no CI).

**Validação:** tsc 0 · lint 0 · build EXIT 0 · 178 testes.

## Aceite da FASE 0

- ✅ Configuração do NextAuth mapeada (providers, callbacks, sessão JWT, tabelas admin×cliente).
- ✅ Fluxo de 1º acesso da cliente e reset do admin mapeados; identificada a **ausência**
  de recuperação para a cliente.
- ✅ Provedor de e-mail decidido (**Resend**, já configurado).
- ✅ Hashing auditado: **bcrypt** nos dois lados (não requer correção urgente).
- ✅ Documento escrito. **Nenhuma mudança de comportamento.**
