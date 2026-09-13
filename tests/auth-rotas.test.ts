import { describe, it, expect } from "vitest";
import { caminhoSeguro, loginComRetorno } from "@/lib/auth-rotas";

/**
 * B5 — depois de entrar, a pessoa volta para a página que ela tentava abrir.
 * O destino vem da URL/formulário, então precisa ser tratado como entrada
 * hostil: aceitar URL absoluta aqui viraria open redirect.
 */

describe("caminhoSeguro", () => {
  it("aceita caminho do próprio site, com query", () => {
    expect(caminhoSeguro("/clube/conta/clube", "/clube/conta")).toBe(
      "/clube/conta/clube",
    );
    expect(caminhoSeguro("/clube/conta/momentos?novo=1", "/clube/conta")).toBe(
      "/clube/conta/momentos?novo=1",
    );
  });

  it("cai no padrão quando não veio nada", () => {
    expect(caminhoSeguro(undefined, "/clube/conta")).toBe("/clube/conta");
    expect(caminhoSeguro(null, "/admin")).toBe("/admin");
    expect(caminhoSeguro("   ", "/admin")).toBe("/admin");
  });

  it("recusa site externo em todas as formas (open redirect)", () => {
    for (const mau of [
      "https://golpe.com",
      "//golpe.com",
      "/\\golpe.com",
      "http://golpe.com/clube",
      "javascript:alert(1)",
    ]) {
      expect(caminhoSeguro(mau, "/clube/conta")).toBe("/clube/conta");
    }
  });

  it("recusa quebra de linha (injeção de header)", () => {
    expect(caminhoSeguro("/clube\r\nSet-Cookie: x=1", "/clube/conta")).toBe(
      "/clube/conta",
    );
  });

  it("nunca devolve para uma tela de auth (evita loop)", () => {
    expect(caminhoSeguro("/clube/entrar", "/clube/conta")).toBe("/clube/conta");
    expect(caminhoSeguro("/admin/login?x=1", "/admin")).toBe("/admin");
    expect(caminhoSeguro("/clube/recuperar", "/clube/conta")).toBe("/clube/conta");
  });
});

describe("loginComRetorno", () => {
  it("guarda o destino codificado na URL do login", () => {
    const href = loginComRetorno("/clube/entrar", "/clube/conta/momentos?novo=1");
    expect(href).toBe(
      "/clube/entrar?callbackUrl=%2Fclube%2Fconta%2Fmomentos%3Fnovo%3D1",
    );
    const devolta = new URL(`https://x${href}`).searchParams.get("callbackUrl");
    expect(caminhoSeguro(devolta, "/clube/conta")).toBe(
      "/clube/conta/momentos?novo=1",
    );
  });
});
