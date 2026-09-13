import { describe, it, expect } from "vitest";
import { maskPhoneBR } from "@/lib/format";
import { normalizeE164BR } from "@/lib/phone";
import {
  SENHA_MIN_CLIENTE,
  emailValido,
  identificarLogin,
  normalizarEmail,
  normalizarSenha,
  normalizarTelefone,
} from "@/lib/auth-identidade";
import {
  destinoCanonico,
  hostIsento,
  opcoesCookie,
  TTL_SESSAO_ADMIN_S,
  TTL_SESSAO_CLIENTE_MS,
} from "@/lib/auth-cookies";
import {
  codigoLocked,
  mensagemLoginAdmin,
  ERRO_THROTTLED,
} from "@/lib/auth-mensagens";

/**
 * B1 — "a senha está certa e o login não é efetuado; em alguns navegadores a
 * senha não aceita". As três causas viram teste aqui: telefone deformado pela
 * máscara, senha com espaço nas pontas e sessão presa a um único domínio.
 */

const CANONICO = "+5521998626845";
const FORMATOS = [
  "(21) 99862-6845",
  "21998626845",
  "+55 21 99862-6845",
  " 21 99862 6845 ",
  "5521998626845",
  "+5521998626845",
];

describe("B1 — telefone normaliza igual em qualquer formato", () => {
  it.each(FORMATOS)("%s → mesmo identificador", (entrada) => {
    expect(normalizarTelefone(entrada)).toBe(CANONICO);
  });

  it("a máscara do campo não deforma o número com DDI (era o bug)", () => {
    // Antes: "+55 21 99862-6845" → "(55) 21998-6268" → +5555219986268 (outra
    // pessoa). O autofill do Safari/Chrome preenche justamente assim.
    for (const entrada of FORMATOS) {
      expect(normalizarTelefone(maskPhoneBR(entrada))).toBe(CANONICO);
    }
  });

  it("a máscara é idempotente (o campo remascara a cada tecla e no blur)", () => {
    for (const entrada of FORMATOS) {
      const uma = maskPhoneBR(entrada);
      expect(maskPhoneBR(uma)).toBe(uma);
    }
  });

  it("fixo de 10 dígitos continua válido, com e sem DDI", () => {
    expect(normalizarTelefone("(21) 2234-5678")).toBe("+552122345678");
    expect(normalizarTelefone("+55 21 2234-5678")).toBe("+552122345678");
    expect(normalizeE164BR(maskPhoneBR("552122345678"))).toBe("+552122345678");
  });

  it("recusa o que não é telefone brasileiro", () => {
    expect(normalizarTelefone("123")).toBeNull();
    expect(normalizarTelefone("")).toBeNull();
    expect(normalizarTelefone(null)).toBeNull();
  });
});

describe("B1 — senha: trim só nas pontas", () => {
  it("tira espaço do começo e do fim (teclado de celular / colar)", () => {
    expect(normalizarSenha(" minhasenha ")).toBe("minhasenha");
    expect(normalizarSenha("minhasenha\n")).toBe("minhasenha");
  });

  it("NÃO mexe no meio e aceita qualquer caractere", () => {
    expect(normalizarSenha(" mi nha senha ")).toBe("mi nha senha");
    expect(normalizarSenha("çãÇÃ!@#$%¨&*()_+ 💛")).toBe("çãÇÃ!@#$%¨&*()_+ 💛");
  });

  it("nunca limita o comprimento", () => {
    const longa = "a".repeat(500);
    expect(normalizarSenha(longa)).toHaveLength(500);
  });

  it("mínimo da cliente é 6", () => {
    expect(SENHA_MIN_CLIENTE).toBe(6);
  });
});

describe("B1 — e-mail e identificação do login", () => {
  it("e-mail vira minúsculo e sem espaço", () => {
    expect(normalizarEmail("  Mi@MiOzorio.COM.br ")).toBe("mi@miozorio.com.br");
    expect(emailValido(" MI@MIOZORIO.COM.BR ")).toBe(true);
    expect(emailValido("mi@")).toBe(false);
  });

  it("descobre sozinho se é telefone ou e-mail", () => {
    expect(identificarLogin(" MI@Miozorio.com.br ")).toEqual({
      tipo: "email",
      valor: "mi@miozorio.com.br",
    });
    expect(identificarLogin("(21) 99862-6845")).toEqual({
      tipo: "telefone",
      valor: CANONICO,
    });
    expect(identificarLogin("nada")).toBeNull();
    expect(identificarLogin("   ")).toBeNull();
  });
});

describe("B1 — cookie de sessão", () => {
  it("é httpOnly, SameSite=Lax e Path=/ (Strict quebra link do WhatsApp)", () => {
    const o = opcoesCookie(TTL_SESSAO_CLIENTE_MS);
    expect(o.httpOnly).toBe(true);
    expect(o.sameSite).toBe("lax");
    expect(o.path).toBe("/");
    expect(o.maxAge).toBe(30 * 24 * 60 * 60);
  });

  it("sessão da cliente 30 dias, painel 7 dias", () => {
    expect(TTL_SESSAO_CLIENTE_MS).toBe(30 * 24 * 60 * 60 * 1000);
    expect(TTL_SESSAO_ADMIN_S).toBe(7 * 24 * 60 * 60);
  });

  it("por padrão é host-only (sem Domain) — o canônico resolve apex×www", () => {
    expect(opcoesCookie(1000).domain).toBeUndefined();
  });
});

describe("B1 — domínio canônico", () => {
  it("manda www para o apex, preservando o resto", () => {
    expect(destinoCanonico("www.miozorio.com.br", "miozorio.com.br")).toBe(
      "miozorio.com.br",
    );
  });

  it("não redireciona quem já está no canônico (sem laço)", () => {
    expect(destinoCanonico("miozorio.com.br", "miozorio.com.br")).toBeNull();
    expect(destinoCanonico("MIOZORIO.COM.BR", "miozorio.com.br")).toBeNull();
  });

  it("nunca mexe em dev nem no preview do Dokploy", () => {
    expect(hostIsento("localhost:3000")).toBe(true);
    expect(hostIsento("app-123.traefik.me")).toBe(true);
    expect(destinoCanonico("localhost:3000", "miozorio.com.br")).toBeNull();
    expect(destinoCanonico("x.traefik.me", "miozorio.com.br")).toBeNull();
  });

  it("sem host canônico configurado, não redireciona nada", () => {
    expect(destinoCanonico("www.miozorio.com.br", null)).toBeNull();
    expect(destinoCanonico(null, "miozorio.com.br")).toBeNull();
  });
});

describe("B1 — mensagens do login do painel", () => {
  it("credencial errada continua com mensagem única (anti-enumeração)", () => {
    expect(mensagemLoginAdmin("CredentialsSignin")).toBe(
      mensagemLoginAdmin(undefined),
    );
    expect(mensagemLoginAdmin(null)).toMatch(/E-mail ou senha incorretos/);
  });

  it("bloqueio diz quanto tempo esperar — nunca bloqueio silencioso", () => {
    const ate = new Date(Date.now() + 12 * 60_000);
    const codigo = codigoLocked(ate);
    expect(codigo).toBe("CONTA_PAUSADA:12");
    expect(mensagemLoginAdmin(codigo)).toMatch(/12 min/);
    expect(mensagemLoginAdmin(ERRO_THROTTLED)).toMatch(/Muitas tentativas/);
  });

  it("arredonda para cima e nunca mostra 0 min", () => {
    expect(codigoLocked(new Date(Date.now() + 1_000))).toBe("CONTA_PAUSADA:1");
    expect(codigoLocked(new Date(Date.now() - 1_000))).toBe("CONTA_PAUSADA:1");
  });
});
