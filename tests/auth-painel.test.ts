import { describe, it, expect, vi, beforeEach } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

/**
 * Guarda de PÁGINA do painel (B4). Duas partes:
 *
 *  1. unitária — `exigirSessaoDoPainel()` devolve a sessão viva e, para a
 *     sessão derrubada (senha trocada em outro aparelho → o callback `session`
 *     do NextAuth devolve sem `user`), REDIRECIONA para o login com o caminho
 *     de volta — em vez de lançar, que viraria a tela "Ops, algo deu errado".
 *
 *  2. estática — varre `src/app/admin` e falha se uma página nascer sem a
 *     guarda. O layout não roda de novo em navegação por <Link>; uma página
 *     sem a chamada é uma página que a sessão derrubada ainda abre.
 */

const H = vi.hoisted(() => ({
  caminho: null as string | null,
  sessao: null as { user?: { email?: string; name?: string } } | null,
}));

vi.mock("next/headers", () => ({
  headers: () =>
    new Headers(H.caminho === null ? {} : { "x-mi-caminho": H.caminho }),
}));

vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT ${url}`);
  },
}));

// Só a leitura da sessão; o resto do @/lib/auth (NextAuth, Prisma, bcrypt)
// não entra aqui.
vi.mock("@/lib/auth", () => ({
  getAdminSession: async () => H.sessao,
}));

import { exigirSessaoDoPainel } from "@/lib/auth-painel";
import { HEADER_CAMINHO } from "@/lib/auth-rotas";

describe("exigirSessaoDoPainel — guarda de página do painel (B4)", () => {
  beforeEach(() => {
    H.caminho = null;
    H.sessao = null;
  });

  it("lê o mesmo header que o middleware injeta", () => {
    expect(HEADER_CAMINHO).toBe("x-mi-caminho");
  });

  it("sessão viva: devolve a sessão, sem redirecionar", async () => {
    H.sessao = { user: { email: "mi@miozorio.com.br", name: "Mi" } };
    H.caminho = "/admin/clientes";
    const s = await exigirSessaoDoPainel();
    expect(s.user?.email).toBe("mi@miozorio.com.br");
  });

  it("senha trocada em outro aparelho (sessão sem user): login com o caminho de volta", async () => {
    // É assim que o callback `session` devolve quando o tokenVersion não bate
    // ou a conta foi desativada — não é null, é sessão sem `user`.
    H.sessao = { user: undefined };
    H.caminho = "/admin/clientes?pagina=2";
    await expect(exigirSessaoDoPainel()).rejects.toThrow(
      /^REDIRECT \/admin\/login\?callbackUrl=%2Fadmin%2Fclientes%3Fpagina%3D2$/,
    );
  });

  it("sem sessão nenhuma: idem", async () => {
    H.caminho = "/admin/financeiro";
    await expect(exigirSessaoDoPainel()).rejects.toThrow(
      /^REDIRECT \/admin\/login\?callbackUrl=%2Fadmin%2Ffinanceiro$/,
    );
  });

  it("caminho hostil no header vira login seco, nunca open redirect", async () => {
    H.caminho = "//golpe.com";
    await expect(exigirSessaoDoPainel()).rejects.toThrow(
      /^REDIRECT \/admin\/login$/,
    );
    H.caminho = "/\\golpe.com";
    await expect(exigirSessaoDoPainel()).rejects.toThrow(
      /^REDIRECT \/admin\/login$/,
    );
  });

  it("sem header (middleware fora do ar): login seco", async () => {
    await expect(exigirSessaoDoPainel()).rejects.toThrow(
      /^REDIRECT \/admin\/login$/,
    );
  });
});

const ADMIN = path.join(process.cwd(), "src", "app", "admin");
/** Telas de antes do login — as únicas que NÃO podem chamar a guarda. */
const PUBLICAS = new Set(["login/page.tsx", "recuperar/page.tsx"]);

function walk(dir: string, hit: (f: string) => void) {
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) walk(full, hit);
    else hit(full);
  }
}

const relativo = (f: string) => path.relative(ADMIN, f).replace(/\\/g, "/");

describe("toda página do painel chama a guarda (estático)", () => {
  const paginas: string[] = [];
  walk(ADMIN, (f) => {
    if (/[/\\]page\.tsx$/.test(f)) paginas.push(f);
  });
  const protegidas = paginas.filter((f) => !PUBLICAS.has(relativo(f)));

  it("varreu o painel de verdade", () => {
    expect(paginas.length).toBeGreaterThanOrEqual(30);
    expect(protegidas.length).toBe(paginas.length - PUBLICAS.size);
  });

  it("nenhuma página protegida sem `await exigirSessaoDoPainel()`", () => {
    const sem = protegidas
      .filter(
        (f) => !/await exigirSessaoDoPainel\(\)/.test(readFileSync(f, "utf8")),
      )
      .map(relativo);
    expect(sem, `Páginas do painel sem a guarda:\n${sem.join("\n")}`).toEqual(
      [],
    );
  });

  it("nenhuma página usa requireAdmin (lança → tela de erro; página redireciona)", () => {
    const erradas = paginas
      .filter((f) => /requireAdmin/.test(readFileSync(f, "utf8")))
      .map(relativo);
    expect(erradas, `Guarda errada em:\n${erradas.join("\n")}`).toEqual([]);
  });

  it("as telas públicas não chamam a guarda (senão ninguém entra)", () => {
    for (const rel of Array.from(PUBLICAS)) {
      const fonte = readFileSync(path.join(ADMIN, rel), "utf8");
      expect(fonte, rel).not.toMatch(/exigirSessaoDoPainel/);
    }
  });
});
