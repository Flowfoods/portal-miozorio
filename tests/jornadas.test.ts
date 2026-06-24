import { describe, it, expect } from "vitest";
import { buildJornadaText, type EtapaMsg } from "@/lib/jornadas";

const content: Record<string, string> = {
  "msg.boas_vindas": "Que alegria, {nome}! Bem-vinda.",
};

describe("buildJornadaText", () => {
  it("usa o template do CMS quando há templateKey", () => {
    const etapa: EtapaMsg = { templateKey: "msg.boas_vindas", template: "fallback" };
    expect(buildJornadaText(content, etapa, { nome: "Ana", servico: null })).toBe(
      "Que alegria, Ana! Bem-vinda.",
    );
  });

  it("cai no template inline quando o CMS não tem a chave", () => {
    const etapa: EtapaMsg = {
      templateKey: "msg.inexistente",
      template: "Oi, {nome}! Volte para o seu {servico}.",
    };
    expect(
      buildJornadaText(content, etapa, { nome: "Bia", servico: "Escova" }),
    ).toBe("Oi, Bia! Volte para o seu Escova.");
  });

  it("interpola só {nome} quando não há serviço", () => {
    const etapa: EtapaMsg = { templateKey: null, template: "Oi, {nome}!{servico}" };
    expect(buildJornadaText(content, etapa, { nome: "Cá", servico: null })).toBe(
      "Oi, Cá!",
    );
  });

  it("retorna null quando não há template nenhum", () => {
    const etapa: EtapaMsg = { templateKey: null, template: null };
    expect(buildJornadaText(content, etapa, { nome: "X", servico: null })).toBeNull();
  });
});
