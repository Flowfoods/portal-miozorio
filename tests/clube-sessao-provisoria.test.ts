import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

/**
 * Sessão PROVISÓRIA da cliente — quem ainda não criou senha.
 *
 * No primeiro acesso a senha é o próprio telefone (`loginCliente`, ramo
 * `provisoria`), então **quem sabe o número entra**. Por isso o portal trata
 * `prov: true` como "ainda não é a dona": cada tela da conta manda para
 * `/clube/conta/senha` antes de mostrar qualquer coisa.
 *
 * Achado da verificação pós-revisão (15/09/2026): `/clube/painel/[codigo]`,
 * a carteirinha, conferia a sessão e que o código é da própria pessoa — e
 * **não** conferia `prov`. O comentário da própria página diz o que ela
 * mostra: nome, saldo, segmento e o próximo atendimento com dia e hora, "a
 * localização física de uma mulher, em horário exato". Com o telefone e o
 * código de indicação (que a membro divulga de propósito, é o link de
 * convite), dava para ler tudo isso sem criar senha — ou seja, sem deixar
 * rastro e sem trancar a dona para fora, que é o que uma tomada de conta
 * faria.
 *
 * Este teste é estático porque o alvo é uma página do App Router: RSC async
 * com Prisma e `redirect()`, que não se instancia fora do servidor do Next.
 * O que dá para garantir sem browser é que nenhuma tela que lê a sessão da
 * cliente esqueça a flag.
 */

const SITE = path.join(process.cwd(), "src", "app", "(site)");

function walk(dir: string, hit: (f: string) => void) {
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) walk(full, hit);
    else hit(full);
  }
}

const leitores: { rel: string; fonte: string }[] = [];
walk(SITE, (f) => {
  if (!/\.tsx?$/.test(f)) return;
  const fonte = readFileSync(f, "utf8");
  if (!/getClienteSession\(\)/.test(fonte)) return;
  leitores.push({ rel: path.relative(SITE, f).replace(/\\/g, "/"), fonte });
});

describe("telas da cliente — sessão provisória nunca vê dado da conta", () => {
  it("achou os leitores da sessão no site", () => {
    // Se este número despencar, a varredura quebrou e os outros testes deste
    // arquivo passam à toa.
    expect(leitores.length).toBeGreaterThanOrEqual(10);
    expect(leitores.map((l) => l.rel)).toContain(
      "clube/painel/[codigo]/page.tsx",
    );
  });

  it("toda tela que lê a sessão confere `prov`", () => {
    const sem = leitores
      .filter((l) => !/\.prov\b/.test(l.fonte))
      .map((l) => l.rel);
    expect(
      sem,
      `Lê a sessão da cliente e ignora a senha provisória:\n${sem.join("\n")}`,
    ).toEqual([]);
  });

  it("a carteirinha manda a provisória criar senha antes de mostrar a agenda", () => {
    const carteirinha = leitores.find(
      (l) => l.rel === "clube/painel/[codigo]/page.tsx",
    )!;
    // Mesma convenção das outras telas da conta: redirect, não notFound —
    // a pessoa É a dona, só não terminou de entrar.
    expect(carteirinha.fonte).toMatch(
      /if\s*\(\s*sessao\.prov\s*\)\s*redirect\("\/clube\/conta\/senha"\)/,
    );
    // E antes de qualquer consulta de agenda/pontos: a guarda fica junto das
    // outras, não depois do Promise.all.
    const posGuarda = carteirinha.fonte.indexOf("sessao.prov");
    const posAgenda = carteirinha.fonte.indexOf("Promise.all");
    expect(posGuarda).toBeGreaterThan(0);
    expect(posGuarda).toBeLessThan(posAgenda);
  });
});
