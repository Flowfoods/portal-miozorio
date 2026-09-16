/**
 * QA ponta a ponta do agendamento — posse da reserva e teto por IP.
 *
 * Roteiro que a dívida da posse pedia ("fazer junto com um QA logado de ponta a
 * ponta"). Resultado da execução de 14/09/2026: `docs/agenda/QA-POSSE-TETO.md`.
 *
 * Roda contra um portal LOCAL, com banco de verdade. NUNCA aponte para
 * produção: o roteiro cria reservas e confirma horários.
 *
 * Playwright não é dependência do repo (não vale carregar um browser no
 * `npm ci` de todo mundo por um script de QA):
 *
 *   npm i --no-save playwright
 *   node scripts/qa-agendar.mjs
 *
 * O roteiro DEIXA ESTADO: ele ocupa horários e, no cenário D, troca a senha
 * provisória da cliente de teste por uma de verdade. Entre execuções, zere:
 *
 *   delete from booking_events; delete from notification_log;
 *   delete from bookings;       delete from auth_log;
 *   update customers set club_password_hash = null,
 *                        club_password_provisoria = true,
 *                        club_token_version = 0,
 *                        club_failed_logins = 0,
 *                        club_locked_until = null;
 *
 * Envs: BASE (default http://localhost:3000) e CHROME (caminho do executável,
 * quando o Chromium não é o que o playwright baixaria).
 */
import { chromium } from "playwright";

const BASE = process.env.BASE ?? "http://localhost:3000";
const CHROME = process.env.CHROME || undefined;
const IP_BOT = "203.0.113.77";
/**
 * Os próximos 60 dias. Não filtramos fim de semana aqui de propósito: quem
 * decide onde há agenda é `/api/availability` (a janela vive em
 * `business_settings`, R3/R15 — hoje é sáb/dom, amanhã pode não ser).
 * `primeiroLivre` pula os dias que voltarem vazios.
 */
const DIAS = Array.from({ length: 60 }, (_, i) => {
  const d = new Date();
  d.setDate(d.getDate() + 1 + i);
  return d.toISOString().slice(0, 10);
});

if (/miozorio\.com\.br/i.test(BASE)) {
  console.error(
    "Este roteiro CRIA E CONFIRMA reservas. Não rode contra produção.",
  );
  process.exit(2);
}

let falhas = 0;
const ok = (c, m) => {
  console.log(`${c ? "  OK  " : " FALHA"} ${m}`);
  if (!c) falhas++;
};

/** Serviço agendável mais simples: sem variação de tamanho (que exigiria foto). */
async function servicoSimples(api) {
  const { services } = await (await api.get(`${BASE}/api/services`)).json();
  const s = services.find(
    (x) => !x.variantes?.length && !x.isCourse && x.priceCents > 0,
  );
  if (!s) throw new Error("nenhum serviço agendável simples no seed");
  return s;
}

async function primeiroLivre(api, serviceId) {
  for (const date of DIAS) {
    const r = await api.get(
      `${BASE}/api/availability?serviceId=${serviceId}&date=${date}`,
    );
    const { slots } = await r.json();
    if (slots?.length) return { date, time: slots[0] };
  }
  throw new Error(
    "acabaram os horários livres — limpe as reservas do banco de QA",
  );
}

async function criar(api, serviceId, telefone, headers = {}) {
  const { date, time } = await primeiroLivre(api, serviceId);
  return api.post(`${BASE}/api/bookings`, {
    headers,
    data: {
      serviceId,
      date,
      time,
      location: "studio",
      customer: { name: "Cliente QA", phone: telefone },
      lgpdConsent: true,
    },
  });
}

/** Preenche o passo 4 do wizard e pede para continuar. */
async function preencher(page, nome, telefone, alergia) {
  await page.getByPlaceholder("Como você gosta de ser chamada").fill(nome);
  await page.getByPlaceholder("(21) 90000-0000").fill(telefone);
  if (alergia !== undefined) {
    await page
      .getByPlaceholder("Conte aqui qualquer sensibilidade da sua pele")
      .fill(alergia);
  }
  await page.locator("select").first().selectOption({ index: 1 }); // ocasião é obrigatória
  // Pelo TEXTO, nunca por posição: quando há alergia de verdade, a caixinha de
  // dado de saúde aparece ANTES da de privacidade, e um `.first()` marcaria a
  // errada — dando um verde falso justamente no cenário que interessa.
  await caixaPrivacidade(page).check();
  await page.getByRole("button", { name: "Continuar" }).click();
}

/** A caixinha da política de privacidade (sempre presente no passo 4). */
function caixaPrivacidade(page) {
  return page
    .locator("label", { hasText: "Li e aceito a" })
    .locator('input[type="checkbox"]');
}

/** A caixinha de dado de saúde — só existe quando há alergia DE VERDADE. */
function caixaSaude(page) {
  return page
    .locator("label", { hasText: "autorizo a Mi a guardar" })
    .locator('input[type="checkbox"]');
}

/** Clica no primeiro dia que ainda tenha horário livre. */
async function escolherDiaEHora(page) {
  const dias = page.locator("main button").filter({ hasText: /SÁB|DOM/ });
  for (let i = 0; i < (await dias.count()); i++) {
    await dias.nth(i).click();
    await page.waitForTimeout(900);
    const horas = page
      .locator("main button")
      .filter({ hasText: /^\d\d:\d\d$/ });
    if (await horas.count()) return void (await horas.first().click());
    await page
      .locator("main button")
      .filter({ hasText: "‹ voltar" })
      .first()
      .click();
    await page.waitForTimeout(500);
  }
  throw new Error("nenhum dia com horário livre na tela");
}

const b = await chromium.launch({ executablePath: CHROME });
const servico = await servicoSimples((await b.newContext()).request);
console.log(`serviço do roteiro: ${servico.name}`);

// ── A) a cliente marca e confirma pela TELA ──────────────────────────────────
console.log("\n=== A) marcar e confirmar pela tela (390px, R19) ===");
const ctxA = await b.newContext({ viewport: { width: 390, height: 844 } });
const pA = await ctxA.newPage();
await pA.goto(`${BASE}/agendar`);
await pA
  .getByText(servico.name, { exact: true })
  .first()
  .click({ timeout: 20000 });
await escolherDiaEHora(pA);
await preencher(pA, "Cliente QA", "21999990001");
await pA
  .getByRole("button", { name: "Confirmar meu horário" })
  .waitFor({ timeout: 20000 });

const posse = (await ctxA.cookies()).filter((c) =>
  c.name.startsWith("mi_posse_"),
);
ok(
  posse.length === 1,
  `comprovante emitido na criação (${posse.length} cookie)`,
);
const c0 = posse[0];
const idA = c0?.name.replace("mi_posse_", "");
ok(!!c0?.httpOnly, "é httpOnly — nenhum script lê");
ok(c0?.path === "/", "path=/ — vale no site inteiro");
ok(c0?.sameSite === "Lax", "SameSite=Lax — link do WhatsApp não derruba");
ok(
  !!idA && !c0.value.includes(idA),
  "não carrega o id nem PII — só prazo e assinatura",
);

await pA.getByRole("button", { name: "Confirmar meu horário" }).click();
await pA.waitForTimeout(2500);
ok(
  /Agendamento confirmado/i.test(await pA.locator("main").innerText()),
  "tela de sucesso apareceu",
);
ok(
  (await ctxA.cookies()).filter((c) => c.name.startsWith("mi_posse_"))
    .length === 0,
  "comprovante limpo depois de confirmar",
);

// ── B) o buraco que a dívida descrevia ───────────────────────────────────────
console.log("\n=== B) estranho com o id não confirma mais ===");
const ctxB = await b.newContext();
const rB = await criar(ctxB.request, servico.id, "21999990002");
const idB = (await rB.json()).id;
ok(rB.status() === 201 && !!idB, `reserva criada (${idB})`);

const ctxEstranho = await b.newContext(); // tem o id, não tem o comprovante
const rE = await ctxEstranho.request.post(
  `${BASE}/api/bookings/${idB}/confirm`,
);
ok(rE.status() === 403, `estranho recebe 403 (recebeu ${rE.status()})`);
ok((await rE.json()).code === "sem_posse", "código sem_posse");
const est = await (
  await ctxEstranho.request.get(`${BASE}/api/bookings/${idB}`)
).json();
ok(est.status === "pending", `a reserva continua pendente (${est.status})`);
const rD = await ctxB.request.post(`${BASE}/api/bookings/${idB}/confirm`);
ok(
  rD.status() === 200,
  `a dona, no mesmo navegador, confirma normal (${rD.status()})`,
);

// ── C) teto por IP ───────────────────────────────────────────────────────────
console.log("\n=== C) teto de reservas por IP ===");
const ctxC = await b.newContext();
const status = [];
for (let i = 0; i < 11; i++) {
  const r = await criar(ctxC.request, servico.id, `2199988${1000 + i}`, {
    "x-forwarded-for": IP_BOT,
  });
  status.push(r.status());
  if (r.status() === 429) {
    console.log(`  mensagem: "${(await r.json()).error}"`);
    break;
  }
}
console.log("  respostas:", status.join(" "));
ok(status.filter((s) => s === 201).length === 10, "10 criações passaram");
ok(status.at(-1) === 429, "a 11ª tomou 429");
ok(
  (await criar(ctxC.request, servico.id, "21977770001")).status() === 201,
  "outro IP não é afetado",
);

// C2 — a TELA diz quantos minutos faltam (e não "tenta de novo?")
console.log("\n=== C2) a cliente barrada lê a mensagem certa ===");
const ctxC2 = await b.newContext({
  viewport: { width: 390, height: 844 },
  extraHTTPHeaders: { "x-forwarded-for": IP_BOT },
});
const pC = await ctxC2.newPage();
await pC.goto(`${BASE}/agendar`);
await pC
  .getByText(servico.name, { exact: true })
  .first()
  .click({ timeout: 20000 });
await escolherDiaEHora(pC);
await preencher(pC, "Cliente Barrada", "21966660001");
await pC.waitForTimeout(2500);
const txt = await pC.locator("main").innerText();
ok(/Tente de novo em \d+ min/.test(txt), "a tela diz quantos minutos faltam");
ok(
  !/Tenta de novo\?/.test(txt),
  "NÃO mostra o genérico que mandava repetir na hora",
);

// ── D) a segunda porta é porta, não portão ───────────────────────────────────
console.log("\n=== D) cliente logada no Clube ===");
const TEL = "21955550001";
const ap1 = await b.newContext();
const idD = (await (await criar(ap1.request, servico.id, TEL)).json()).id;
const ap2 = await b.newContext({ viewport: { width: 390, height: 844 } });
ok(
  (await ap2.request.post(`${BASE}/api/bookings/${idD}/confirm`)).status() ===
    403,
  "outro aparelho, deslogada: 403",
);
const pD = await ap2.newPage();
await pD.goto(`${BASE}/clube/entrar`);
await pD.locator('input[type="tel"]').first().fill(TEL);
await pD.locator('input[type="password"]').first().fill(TEL); // 1º acesso: senha = telefone
await pD.getByRole("button", { name: "Entrar", exact: true }).click();
await pD.waitForTimeout(3000);
ok(
  (await ap2.cookies()).some((c) => c.name === "mi_clube"),
  "entrou no Clube neste aparelho",
);

// Sessão PROVISÓRIA (1º acesso) não vale como prova de posse: a senha ainda é
// o próprio telefone, que qualquer pessoa que conheça o número sabe.
ok(
  (await ap2.request.post(`${BASE}/api/bookings/${idD}/confirm`)).status() ===
    403,
  "sessão provisória (senha = telefone) NÃO confirma",
);

// Depois de definir uma senha de verdade, a mesma cliente confirma.
await pD.goto(`${BASE}/clube/conta/senha`);
await pD.locator('input[name="password"]').first().fill("senha-de-qa-123");
const consent = pD.locator('input[name="consent"]');
if (await consent.count()) await consent.first().check();
await pD.locator("form button").last().click();
await pD.waitForTimeout(3000);
ok(
  (await ap2.request.post(`${BASE}/api/bookings/${idD}/confirm`)).status() ===
    200,
  "com senha própria, a dona confirma de outro aparelho",
);

const ap3 = await b.newContext();
const idAlheio = (
  await (await criar(ap3.request, servico.id, "21944440001")).json()
).id;
ok(
  (
    await ap2.request.post(`${BASE}/api/bookings/${idAlheio}/confirm`)
  ).status() === 403,
  "cliente logada NÃO confirma reserva alheia",
);

// ── E) "Não" na alergia não é dado de saúde ─────────────────────────────────
// O bug: quem respondia "Não" via a caixinha de dado sensível e, sem marcá-la,
// NÃO CONSEGUIA AGENDAR. Eram duas definições de "alergia de verdade" no repo
// (o alerta da agenda filtrava negações, o consentimento não).
console.log('\n=== E) "Não" na alergia não vira dado de saúde ===');
const ctxE = await b.newContext({ viewport: { width: 390, height: 844 } });
const pE = await ctxE.newPage();
await pE.goto(`${BASE}/agendar`);
await pE
  .getByText(servico.name, { exact: true })
  .first()
  .click({ timeout: 20000 });
await escolherDiaEHora(pE);
await preencher(pE, "Cliente Sem Alergia", "21933330001", "Não");
await pE.waitForTimeout(2500);
ok(
  (await caixaSaude(pE).count()) === 0,
  'com "Não", a caixinha de dado de saúde nem aparece',
);
ok(
  /Confirmar meu horário|Agendamento confirmado/i.test(
    await pE.locator("main").innerText(),
  ),
  'com "Não", ela CONSEGUE agendar (o bug barrava aqui)',
);

// E o contrário: alergia de verdade continua exigindo a autorização.
const ctxE2 = await b.newContext({ viewport: { width: 390, height: 844 } });
const pE2 = await ctxE2.newPage();
await pE2.goto(`${BASE}/agendar`);
await pE2
  .getByText(servico.name, { exact: true })
  .first()
  .click({ timeout: 20000 });
await escolherDiaEHora(pE2);
await preencher(pE2, "Cliente Com Alergia", "21922220001", "níquel e látex");
await pE2.waitForTimeout(2000);
ok(
  (await caixaSaude(pE2).count()) === 1,
  "com alergia de verdade, a autorização É pedida",
);
ok(
  /Falta autorizar o cuidado com a informação de alergia/.test(
    await pE2.locator("main").innerText(),
  ),
  "e sem marcá-la o agendamento é barrado, como deve ser",
);

await b.close();
console.log(falhas ? `\n>>> ${falhas} FALHA(S)` : "\n>>> TUDO VERDE");
process.exit(falhas ? 1 : 0);
