import { describe, it, expect } from "vitest";
import {
  CAMPOS_DE_SAUDE,
  carimboConsentimentoSaude,
  coletaDadoDeSaude,
  faltaConsentimentoSaude,
} from "../src/lib/consentimento-saude";
import { temAlergia } from "../src/lib/anamnesis";

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
    // MUDANÇA DELIBERADA (14/09/2026): antes este caso esperava `true`, com a
    // justificativa de que `"0"` "tem conteúdo". Desde que a regra passou a ser
    // a MESMA do alerta da agenda, `"0"` é negação — a A11 o pôs na lista
    // porque gente responde "0" quando quer dizer "nenhuma". O objetivo do
    // teste era robustez (não quebrar com JSON torto), e isso continua valendo;
    // o `true` era raciocínio sobre a implementação antiga, não requisito.
    expect(coletaDadoDeSaude({ alergia: 0 })).toBe(false);
    expect(coletaDadoDeSaude({ alergia: null })).toBe(false);
    expect(coletaDadoDeSaude({ alergia: undefined })).toBe(false);
    // O que importa de verdade: nada aqui lança.
    expect(() =>
      coletaDadoDeSaude({ alergia: { nested: true } as unknown }),
    ).not.toThrow();
    expect(coletaDadoDeSaude({ alergia: 42 })).toBe(true); // número qualquer conta
  });
});

describe("faltaConsentimentoSaude — quem é recusado", () => {
  it("sem alergia, não exige nada (o caso da maioria das clientes)", () => {
    expect(faltaConsentimentoSaude({ ocasiao: "festa" }, undefined)).toBe(
      false,
    );
    expect(faltaConsentimentoSaude({ alergia: "" }, false)).toBe(false);
  });

  it("com alergia e sem consentimento, recusa", () => {
    expect(faltaConsentimentoSaude({ alergia: "níquel" }, undefined)).toBe(
      true,
    );
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
    expect(carimboConsentimentoSaude({ alergia: "  " }, true, agora)).toBe(
      null,
    );
  });

  it("NÃO carimba sem consentimento", () => {
    expect(carimboConsentimentoSaude({ alergia: "níquel" }, false, agora)).toBe(
      null,
    );
  });
});

describe("negação pura não é dado de saúde", () => {
  const agora = new Date("2026-09-14T18:00:00.000Z");

  // O bug que isto trava: quem respondia "Não" via a caixinha de dado
  // sensível e, sem marcá-la, NÃO CONSEGUIA AGENDAR — e, marcando, ganhava um
  // health_consent_at carimbado para um dado que não existe. Eram duas
  // definições de "alergia de verdade" no repo, e elas discordavam: o alerta
  // da agenda (A11) já filtrava negações, este módulo não.
  it.each([
    "Não",
    "não",
    "NÃO",
    "nao",
    "n",
    "nenhuma",
    "nada",
    "-",
    "x",
    "sem alergia",
    "negativo",
    "0",
    "  Não.  ",
  ])("%o não exige consentimento nem carimba", (resposta) => {
    expect(coletaDadoDeSaude({ alergia: resposta })).toBe(false);
    expect(faltaConsentimentoSaude({ alergia: resposta }, undefined)).toBe(
      false,
    );
    expect(carimboConsentimentoSaude({ alergia: resposta }, true, agora)).toBe(
      null,
    );
  });

  it("texto ambíguo CONTINUA sendo dado de saúde — o lado seguro", () => {
    // O viés da A11 vale aqui também: só a lista fechada apaga. "Não uso látex,
    // mas tenho alergia a níquel" é alergia de verdade, e um "contém não"
    // ingênuo a teria silenciado.
    for (const real of [
      "não uso látex, mas tenho alergia a níquel",
      "nenhuma que eu saiba, fora fragrância",
      "níquel",
      "não sei",
    ]) {
      expect(coletaDadoDeSaude({ alergia: real })).toBe(true);
      expect(faltaConsentimentoSaude({ alergia: real }, undefined)).toBe(true);
    }
  });

  it("a mesma regra do alerta da agenda, não uma cópia", () => {
    // Se as duas divergirem de novo, este teste cai.
    for (const texto of ["Não", "nenhuma", "níquel", "não sei"]) {
      expect(coletaDadoDeSaude({ alergia: texto })).toBe(
        temAlergia({ alergia: texto }),
      );
    }
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
