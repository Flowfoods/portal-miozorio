import { describe, it, expect } from "vitest";
import { temAlergia, lerAnamnese } from "@/lib/anamnesis";

const com = (alergia: unknown) => ({ alergia, referencia: "", ocasiao: "" });

describe("A11 — o alerta cala quando a resposta é 'não'", () => {
  const negacoes = [
    "Não",
    "não",
    "nao",
    "NÃO",
    "  não  ",
    "Não.",
    "não!",
    "n",
    "N",
    "nenhuma",
    "Nenhuma alergia",
    "nada",
    "-",
    "x",
    "Não tenho",
    "não tenho alergia",
    "Sem alergia",
    "sem alergias",
    "negativo",
    "0",
  ];
  for (const r of negacoes) {
    it(`"${r}" → sem alerta`, () => {
      expect(temAlergia(com(r))).toBe(false);
    });
  }

  it("campo vazio e ausente → sem alerta", () => {
    expect(temAlergia(com(""))).toBe(false);
    expect(temAlergia(com("   "))).toBe(false);
    expect(temAlergia({})).toBe(false);
    expect(temAlergia(null)).toBe(false);
    expect(temAlergia(undefined)).toBe(false);
  });
});

describe("A11 — o alerta acende no que importa", () => {
  const positivas = [
    "Sim, a látex",
    "sim",
    "alergia a níquel",
    "Tenho alergia a esmalte",
    "rímel me irrita o olho",
  ];
  for (const r of positivas) {
    it(`"${r}" → alerta`, () => {
      expect(temAlergia(com(r))).toBe(true);
    });
  }

  it("negação PARCIAL acende — o caso que um 'contém não' silenciaria", () => {
    // O motivo de a lista ser fechada em vez de procurar "não" no texto.
    expect(temAlergia(com("não uso látex, mas tenho alergia a níquel"))).toBe(
      true,
    );
    expect(temAlergia(com("não sei se é alergia, mas fico vermelha"))).toBe(
      true,
    );
    expect(temAlergia(com("nada de esmalte, sou alérgica"))).toBe(true);
  });

  it("tipo inesperado não derruba nem inventa alerta", () => {
    expect(temAlergia(com(123))).toBe(false);
    expect(temAlergia(com({ a: 1 }))).toBe(false);
    expect(temAlergia("string solta")).toBe(false);
  });
});

describe("lerAnamnese segue intacta", () => {
  it("devolve os três campos com trim, sem filtrar nada", () => {
    // O filtro é só do badge: o texto cru continua visível na ficha, senão a
    // Mi perderia o "Não" que a cliente de fato respondeu.
    const r = lerAnamnese({
      alergia: "  Não  ",
      referencia: " foto do pinterest ",
      ocasiao: "casamento",
    });
    expect(r.alergia).toBe("Não");
    expect(r.referencia).toBe("foto do pinterest");
    expect(r.ocasiao).toBe("casamento");
  });
});
