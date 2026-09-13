import { describe, it, expect, afterEach } from "vitest";
import {
  CODIGO_TTL_MS,
  MAX_TENTATIVAS,
  COOLDOWN_MS,
  TROCA_TTL_MS,
  RECUP_NEUTRO,
  linkParaCliente,
  numerosDaMi,
  textoParaMi,
  textoParaPessoa,
} from "@/lib/recuperacao";
import {
  RECUP_MIN_MINUTOS,
  RECUP_PADRAO_MINUTOS,
  minutosValidadeCodigo,
} from "@/lib/settings";

/**
 * B2/B3 — modelo único de recuperação: o código vai para o WhatsApp da MILENE,
 * que repassa à pessoa no número cadastrado. Aqui testamos o que é puro (texto,
 * links, parâmetros); o ciclo de vida no banco está em `recuperacao-ciclo`.
 */

const ENVS = ["MI_WHATSAPP", "MI_WHATSAPP_EMERGENCIA"] as const;
const original = Object.fromEntries(ENVS.map((k) => [k, process.env[k]]));
afterEach(() => {
  for (const k of ENVS) {
    if (original[k] === undefined) delete process.env[k];
    else process.env[k] = original[k];
  }
});

describe("B3 — parâmetros do ciclo de vida do código", () => {
  it("o código vale 60 min (o repasse é manual, não é robô)", () => {
    expect(CODIGO_TTL_MS).toBe(60 * 60_000);
  });

  it("a janela entre confirmar e salvar é de 15 min e é independente", () => {
    expect(TROCA_TTL_MS).toBe(15 * 60_000);
    // O bug do print: a janela de troca herdava o TTL do código e vencia junto.
    expect(TROCA_TTL_MS).toBeLessThan(CODIGO_TTL_MS);
  });

  it("5 tentativas de digitação e 60s de cooldown entre pedidos", () => {
    expect(MAX_TENTATIVAS).toBe(5);
    expect(COOLDOWN_MS).toBe(60_000);
  });
});

describe("B2 — resposta pública nunca revela se o cadastro existe", () => {
  it("a mensagem neutra fala da Mi, não da conta", () => {
    expect(RECUP_NEUTRO).toMatch(/Se esse número estiver cadastrado/i);
    expect(RECUP_NEUTRO).not.toMatch(/não encontrad|não existe|inválid/i);
  });
});

describe("B2 — destinos do aviso (WhatsApp da Mi + emergência)", () => {
  it("usa o número principal da Mi", () => {
    process.env.MI_WHATSAPP = "+55 21 97022-5231";
    delete process.env.MI_WHATSAPP_EMERGENCIA;
    expect(numerosDaMi()).toEqual(["5521970225231"]);
  });

  it("inclui o contato de emergência quando configurado", () => {
    process.env.MI_WHATSAPP = "+5521970225231";
    process.env.MI_WHATSAPP_EMERGENCIA = "+5521999998888";
    expect(numerosDaMi()).toEqual(["5521970225231", "5521999998888"]);
  });

  it("ignora env vazia ou curta demais em vez de tentar enviar", () => {
    process.env.MI_WHATSAPP = "";
    process.env.MI_WHATSAPP_EMERGENCIA = "123";
    expect(numerosDaMi()).toEqual([]);
  });
});

describe("B2 — texto que a Mi recebe", () => {
  const base = {
    nome: "Ana Paula Souza",
    perfil: "cliente" as const,
    identificadorVisivel: "(21) 99862-6845",
    codigo: "482915",
    ate: "14:35",
  };

  it("traz nome, número cadastrado, perfil, código e prazo", () => {
    const t = textoParaMi(base);
    expect(t).toContain("Ana Paula Souza");
    expect(t).toContain("(21) 99862-6845");
    expect(t).toContain("cliente do Clube");
    expect(t).toContain("482915");
    expect(t).toContain("14:35");
  });

  it("distingue o pedido de acesso ao painel", () => {
    const t = textoParaMi({
      ...base,
      perfil: "admin",
      identificadorVisivel: "mi@miozorio.com.br",
    });
    expect(t).toContain("acesso ao painel");
    expect(t).toContain("mi@miozorio.com.br");
  });

  it("embute a mensagem pronta para encaminhar, sem reescrever nada", () => {
    const pronta = textoParaPessoa(base.nome, base.codigo, base.ate);
    expect(textoParaMi(base)).toContain(pronta);
  });
});

describe("B2 — mensagem pronta para a cliente (voz da Mi)", () => {
  it("chama pelo primeiro nome e fala por 'você'", () => {
    const t = textoParaPessoa("Ana Paula Souza", "482915", "14:35");
    expect(t).toMatch(/^Oi, Ana!/);
    expect(t).toContain("482915");
    expect(t).toContain("14:35");
    expect(t).toContain("💛");
    expect(t).not.toMatch(/token|OTP|autentica|protocolo/i);
  });

  it("aguenta nome de uma palavra só e espaços sobrando", () => {
    expect(textoParaPessoa("  Bia  ", "000111", "09:05")).toMatch(/^Oi, Bia!/);
  });

  it("o link para a Mi mandar abre a conversa da cliente com o texto pronto", () => {
    const link = linkParaCliente("+5521998626845", "Ana", "482915", "14:35");
    expect(link.startsWith("https://wa.me/5521998626845?text=")).toBe(true);
    expect(decodeURIComponent(link)).toContain("482915");
  });
});

describe("B3 — validade configurável pela Mi (piso de 15 min)", () => {
  it("sem configuração, vale o padrão de 60 min", () => {
    expect(minutosValidadeCodigo(undefined)).toBe(RECUP_PADRAO_MINUTOS);
    expect(minutosValidadeCodigo(null)).toBe(RECUP_PADRAO_MINUTOS);
    expect(minutosValidadeCodigo("abacaxi")).toBe(RECUP_PADRAO_MINUTOS);
    expect(RECUP_PADRAO_MINUTOS).toBe(60);
  });

  it("respeita o que a Mi escolher, acima do piso", () => {
    expect(minutosValidadeCodigo(90)).toBe(90);
    expect(minutosValidadeCodigo(15)).toBe(15);
    expect(minutosValidadeCodigo("120")).toBe(120);
  });

  it("nunca deixa cair abaixo de 15 min (repasse manual não cabe)", () => {
    expect(RECUP_MIN_MINUTOS).toBe(15);
    expect(minutosValidadeCodigo(1)).toBe(RECUP_MIN_MINUTOS);
    expect(minutosValidadeCodigo(10)).toBe(RECUP_MIN_MINUTOS);
    expect(minutosValidadeCodigo(-5)).toBe(RECUP_PADRAO_MINUTOS);
    expect(minutosValidadeCodigo(0)).toBe(RECUP_PADRAO_MINUTOS);
  });
});
