import { describe, it, expect } from "vitest";
import { DateTime } from "luxon";
import { evaluateCancellation, evaluateNoShow } from "@/lib/policies";

const TZ = "America/Sao_Paulo";
const mk = (iso: string) => DateTime.fromISO(iso, { zone: TZ });

describe("policies — cancelamento e régua de strikes", () => {
  const startsAt = mk("2026-06-13T14:00");

  it("dentro do prazo: sem strike, sem retenção de sinal", () => {
    const r = evaluateCancellation({
      startsAt,
      now: mk("2026-06-09T10:00"), // 4 dias antes (janela = 3)
      cancelWindowDays: 3,
      currentStrikes: 1,
      strikeLimit: 3,
      hasDeposit: true,
      actor: "client",
    });
    expect(r.withinWindow).toBe(true);
    expect(r.depositRetained).toBe(false);
    expect(r.newStrikes).toBe(1);
    expect(r.requiresDeposit).toBe(false);
  });

  it("fora do prazo: retém sinal + incrementa strike", () => {
    const r = evaluateCancellation({
      startsAt,
      now: mk("2026-06-12T10:00"), // 2 dias antes (< janela de 3)
      cancelWindowDays: 3,
      currentStrikes: 1,
      strikeLimit: 3,
      hasDeposit: true,
      actor: "client",
    });
    expect(r.withinWindow).toBe(false);
    expect(r.depositRetained).toBe(true);
    expect(r.newStrikes).toBe(2);
    expect(r.requiresDeposit).toBe(false);
  });

  it("M1.5#6 — 3º strike liga requires_deposit", () => {
    // cancelamento fora do prazo partindo de 2 strikes → 3 → exige sinal
    const cancel = evaluateCancellation({
      startsAt,
      now: mk("2026-06-12T10:00"),
      cancelWindowDays: 3,
      currentStrikes: 2,
      strikeLimit: 3,
      hasDeposit: false,
      actor: "client",
    });
    expect(cancel.newStrikes).toBe(3);
    expect(cancel.requiresDeposit).toBe(true);

    // no-show partindo de 2 strikes → 3 → exige sinal + retém sinal
    const noShow = evaluateNoShow({
      currentStrikes: 2,
      strikeLimit: 3,
      hasDeposit: true,
    });
    expect(noShow.newStrikes).toBe(3);
    expect(noShow.requiresDeposit).toBe(true);
    expect(noShow.depositRetained).toBe(true);
  });

  it("cancelamento pelo negócio nunca penaliza a cliente", () => {
    const r = evaluateCancellation({
      startsAt,
      now: mk("2026-06-13T10:00"), // mesmo dia (fora do prazo)
      cancelWindowDays: 3,
      currentStrikes: 2,
      strikeLimit: 3,
      hasDeposit: true,
      actor: "business",
    });
    expect(r.finalStatus).toBe("cancelled_by_business");
    expect(r.depositRetained).toBe(false);
    expect(r.newStrikes).toBe(2); // sem incremento
  });
});
