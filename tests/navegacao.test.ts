import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

/**
 * Guardião do "Teste do Botão" (nível de link, sem browser): varre o código e
 * garante que TODO destino interno (`Link`/`href="/..."`) aponta para uma rota
 * existente e que não há âncora morta (`href="#"`/`href=""`). Roda na suíte
 * normal (vitest) — complementa um e2e Playwright (que exigiria DB+browser).
 */

const APP = path.join(process.cwd(), "src", "app");
const SRC = path.join(process.cwd(), "src");

function walk(dir: string, hit: (f: string) => void) {
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) walk(full, hit);
    else hit(full);
  }
}

/** Rotas válidas a partir dos arquivos page.tsx/route.ts (URL, sem grupos). */
function collectRoutes(): { exact: Set<string>; dynamic: RegExp[] } {
  const exact = new Set<string>(["/"]);
  const dynamic: RegExp[] = [];
  walk(APP, (full) => {
    if (!/[/\\](page|route)\.(t|j)sx?$/.test(full)) return;
    let rel = full.slice(APP.length).replace(/\\/g, "/");
    rel = rel.replace(/\/(page|route)\.(t|j)sx?$/, "");
    rel = rel.replace(/\/\([^/]+\)/g, ""); // remove route groups (site)/(admin)
    if (rel === "") rel = "/";
    if (/\[.+\]/.test(rel)) {
      const re = "^" + rel.replace(/\[\.\.\..+?\]/g, ".+").replace(/\[[^/]+?\]/g, "[^/]+") + "$";
      dynamic.push(new RegExp(re));
    } else {
      exact.add(rel);
    }
  });
  return { exact, dynamic };
}

/** Extrai pathnames internos de href="..." e href={`...`} de um arquivo. */
function internalHrefs(content: string): string[] {
  const out: string[] = [];
  const re = /href=(?:"([^"]*)"|\{`([^`]*)`\})/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(content))) {
    const raw = m[1] ?? m[2] ?? "";
    if (!raw.startsWith("/")) continue; // externos/anchors/mailto → fora
    // só o pathname: corta query/hash e qualquer interpolação ${...}
    let p = raw.split("?")[0]!.split("#")[0]!;
    if (p.includes("${")) p = p.slice(0, p.indexOf("${")).replace(/\/$/, "");
    out.push(p || "/");
  }
  return out;
}

const { exact, dynamic } = collectRoutes();
const matches = (p: string) =>
  exact.has(p) ||
  dynamic.some((re) => re.test(p)) ||
  // prefixo dinâmico parcial (ex.: "/admin/clientes" de "/admin/clientes/${id}")
  Array.from(exact).some((r) => r.startsWith(p + "/")) ||
  dynamic.some((re) => re.test(p + "/x"));

describe("grafo de navegação — Teste do Botão (estático)", () => {
  it("coletou as rotas esperadas", () => {
    expect(exact.has("/")).toBe(true);
    expect(exact.has("/agendar")).toBe(true);
    expect(exact.has("/noivas")).toBe(true);
    expect(exact.has("/admin")).toBe(true);
    expect(exact.has("/admin/financeiro")).toBe(true);
  });

  it("nenhum href interno aponta para rota inexistente", () => {
    const quebrados: string[] = [];
    walk(SRC, (full) => {
      if (!/\.(t|j)sx?$/.test(full)) return;
      if (full.includes(`${path.sep}api${path.sep}`)) return;
      const content = readFileSync(full, "utf8");
      for (const p of internalHrefs(content)) {
        if (!matches(p)) {
          quebrados.push(`${path.relative(SRC, full)} -> ${p}`);
        }
      }
    });
    expect(quebrados, `Links internos quebrados:\n${quebrados.join("\n")}`).toEqual([]);
  });

  it("não há âncora morta (href vazio ou #)", () => {
    const mortos: string[] = [];
    walk(SRC, (full) => {
      if (!/\.(t|j)sx?$/.test(full)) return;
      const content = readFileSync(full, "utf8");
      if (/href="#"|href=""/.test(content)) {
        mortos.push(path.relative(SRC, full));
      }
    });
    expect(mortos, `Âncoras mortas em:\n${mortos.join("\n")}`).toEqual([]);
  });
});
