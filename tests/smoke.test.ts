import { describe, it, expect } from "vitest";

// Smoke test do scaffold (M0.2). O motor de agendamento e seus testes
// bloqueantes (slots, holds, corrida de double-booking, strikes) entram no M1.5.
describe("scaffold portal-miozorio", () => {
  it("o ambiente de testes está vivo", () => {
    expect(1 + 1).toBe(2);
  });
});
