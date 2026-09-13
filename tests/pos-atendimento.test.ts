import { describe, it, expect } from "vitest";
import { aplicarTemplate, CONTENT_FIELDS } from "@/lib/content";

const membro = CONTENT_FIELDS.find(
  (f) => f.key === "msg.atendimento_concluido",
)!;
const naoMembro = CONTENT_FIELDS.find(
  (f) => f.key === "msg.atendimento_concluido_nao_membro",
)!;

describe("A10 — mensagem pós-atendimento para membro do Clube", () => {
  const texto = aplicarTemplate(membro.default, {
    nome: "Carla",
    pontosAntes: "120",
    pontosGanhos: "30",
    pontosAgora: "150",
    linkClube: "https://miozorio.com.br/clube",
  });

  it("mostra saldo anterior, ganho e saldo atual", () => {
    expect(texto).toContain("120");
    expect(texto).toContain("30");
    expect(texto).toContain("150");
  });

  it("explica o Clube e leva ao portal", () => {
    expect(texto.toLowerCase()).toContain("clube da mi");
    expect(texto).toContain("https://miozorio.com.br/clube");
  });

  it("pede avaliação no Google e autorização da foto (regra do pós-atendimento)", () => {
    expect(texto).toContain("Google");
    expect(texto.toLowerCase()).toContain("autorização");
  });

  it("não sobra placeholder cru", () => {
    expect(texto).not.toMatch(/\{\w+\}/);
  });

  it("está na voz da Mi: trata por 'você' e usa 💛 com moderação", () => {
    expect(texto).toContain("você");
    expect((texto.match(/💛/g) ?? []).length).toBeLessThanOrEqual(2);
  });
});

describe("A10 — versão para quem ainda não é do Clube", () => {
  const texto = aplicarTemplate(naoMembro.default, {
    nome: "Carla",
    linkClube: "https://miozorio.com.br/clube",
  });

  it("convida em vez de falar de saldo que ela não tem", () => {
    expect(texto).not.toContain("Saldo anterior");
    expect(texto.toLowerCase()).toContain("clube da mi");
    expect(texto).toContain("https://miozorio.com.br/clube");
  });

  it("mantém avaliação e autorização de foto", () => {
    expect(texto).toContain("Google");
    expect(texto.toLowerCase()).toContain("autorização");
  });

  it("não sobra placeholder cru", () => {
    expect(texto).not.toMatch(/\{\w+\}/);
  });
});

describe("A10 — as variáveis estão documentadas para a Mi", () => {
  it("a ajuda do admin lista todas, senão ela edita e quebra sem saber", () => {
    for (const v of [
      "{nome}",
      "{pontosAntes}",
      "{pontosGanhos}",
      "{pontosAgora}",
      "{linkClube}",
    ]) {
      expect(membro.ajuda).toContain(v);
    }
    expect(naoMembro.ajuda).toContain("{linkClube}");
  });
});
