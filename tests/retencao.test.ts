import { describe, expect, it } from "vitest";
import { MANUTENCAO_DIAS_DEFAULT } from "@/lib/jornadas";

/**
 * A regra de negócio da retenção (F5) — "passou da cadência?" — é um
 * comparador simples de dias. Aqui garantimos a fronteira e o default,
 * sem tocar o banco (getSugestaoRetorno faz as queries; a decisão é esta).
 */
function devesugerir(diasDesde: number, cadencia: number): boolean {
  return diasDesde >= cadencia;
}

describe("retenção · fronteira da cadência", () => {
  it("não sugere dentro da cadência", () => {
    expect(devesugerir(30, 60)).toBe(false);
    expect(devesugerir(59, 60)).toBe(false);
  });

  it("sugere ao atingir/passar a cadência", () => {
    expect(devesugerir(60, 60)).toBe(true);
    expect(devesugerir(120, 60)).toBe(true);
  });

  it("default de manutenção é 60 dias", () => {
    expect(MANUTENCAO_DIAS_DEFAULT).toBe(60);
    expect(devesugerir(MANUTENCAO_DIAS_DEFAULT, MANUTENCAO_DIAS_DEFAULT)).toBe(
      true,
    );
  });
});
