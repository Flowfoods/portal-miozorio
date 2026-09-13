import { describe, it, expect } from "vitest";
import {
  CAMPOS_DE_SAUDE,
  carimboConsentimentoSaude,
  coletaDadoDeSaude,
  faltaConsentimentoSaude,
} from "../src/lib/consentimento-saude";

/**
 * R6/R18 — alergia é dado de saúde e, pela LGPD, sensível (art. 5º, II). O
 * tratamento por consentimento exige que ele seja "específico e destacado"
 * (art. 11, I): o aceite genérico da política de privacidade não cobre.
 *
 * O ponto de desenho que estes testes travam: o consentimento extra só é
 * exigido de quem REALMENTE escreve uma alergia. Pedir autorização de dado
 * sensível para todo mundo seria ruído — e ruído em consentimento é o que
 * treina as pessoas a clicar sem ler.
 */

describe("coletaDadoDeSaude", () => {
  it("anamnese sem alergia não coleta dado de saúde", () => {
    expect(coletaDadoDeSaude({ referencia: "foto do pinterest" })).toBe(false);
    expect(coletaDadoDeSaude({ ocasiao: "casamento" })).toBe(false);
  });

  it("campo vazio ou só espaço não conta como dado de saúde", () => {
    expect(coletaDadoDeSaude({ alergia: "" })).toBe(false);
    expect(coletaDadoDeSaude({ alergia: "   " })).toBe(false);
    expect(coletaDadoDeSaude({ alergia: "\n\t " })).toBe(false);
  });

  it("alergia preenchida conta", () => {
    expect(coletaDadoDeSaude({ alergia: "níquel" })).toBe(true);
  });

  it("anamnese ausente, nula ou vazia não coleta nada", () => {
    expect(coletaDadoDeSaude(undefined)).toBe(false);
    expect(coletaDadoDeSaude(null)).toBe(false);
    expect(coletaDadoDeSaude({})).toBe(false);
  });

  it("valor não-string (bot mandando JSON torto) não quebra a regra", () => {
    expect(coletaDadoDeSaude({ alergia: 0 })).toBe(true); // "0" tem conteúdo
    expect(coletaDadoDeSaude({ alergia: null })).toBe(false);
    expect(coletaDadoDeSaude({ alergia: undefined })).toBe(false);
  });
});

describe("faltaConsentimentoSaude — quem é recusado", () => {
  it("sem alergia, não exige nada (o caso da maioria das clientes)", () => {
    expect(faltaConsentimentoSaude({ ocasiao: "festa" }, undefined)).toBe(false);
    expect(faltaConsentimentoSaude({ alergia: "" }, false)).toBe(false);
  });

  it("com alergia e sem consentimento, recusa", () => {
    expect(faltaConsentimentoSaude({ alergia: "níquel" }, undefined)).toBe(true);
    expect(faltaConsentimentoSaude({ alergia: "níquel" }, false)).toBe(true);
  });

  it("com alergia e consentimento, passa", () => {
    expect(faltaConsentimentoSaude({ alergia: "níquel" }, true)).toBe(false);
  });

  it("só `true` vale como consentimento — nada de valor truthy", () => {
    // A rota é pública: `healthConsent: "sim"` ou `1` não podem virar aceite.
    const truthyTorto = "sim" as unknown as boolean;
    expect(faltaConsentimentoSaude({ alergia: "níquel" }, truthyTorto)).toBe(
      true,
    );
  });
});

describe("carimboConsentimentoSaude — o que vai para a auditoria", () => {
  const agora = new Date("2026-09-13T21:00:00.000Z");

  it("carimba quando há dado de saúde E consentimento", () => {
    expect(carimboConsentimentoSaude({ alergia: "níquel" }, true, agora)).toBe(
      agora,
    );
  });

  it("NÃO carimba quando não há alergia, mesmo com a caixinha marcada", () => {
    // Registrar consentimento que não foi pedido falsifica a auditoria: ficaria
    // parecendo que a pessoa autorizou um tratamento que nunca aconteceu.
    expect(carimboConsentimentoSaude({ ocasiao: "festa" }, true, agora)).toBe(
      null,
    );
    expect(carimboConsentimentoSaude({ alergia: "  " }, true, agora)).toBe(null);
  });

  it("NÃO carimba sem consentimento", () => {
    expect(carimboConsentimentoSaude({ alergia: "níquel" }, false, agora)).toBe(
      null,
    );
  });
});

describe("CAMPOS_DE_SAUDE — o ponto único de extensão", () => {
  it("hoje só a alergia é dado de saúde na anamnese", () => {
    // Se um campo novo de saúde entrar (medicação, gravidez, condição de pele),
    // ele entra nesta lista e passa a exigir o mesmo consentimento sem tocar em
    // mais nada. Este teste existe para que a adição seja consciente.
    expect([...CAMPOS_DE_SAUDE]).toEqual(["alergia"]);
  });
});
