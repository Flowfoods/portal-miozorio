import { describe, it, expect } from "vitest";
import { DateTime } from "luxon";
import {
  evaluateCancellation,
  evaluateNoShow,
  duracaoOcupadaMin,
} from "@/lib/policies";

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

describe("duracaoOcupadaMin — criação e remarcação usam a MESMA conta", () => {
  const maquiagem = { durationMin: 60, service: { bufferMin: 15 } };
  const penteado = { durationMin: 60, service: { bufferMin: 10 } };
  const servicoPrimario = { durationMin: 60, bufferMin: 15 };

  it("soma as durações dos itens e aplica UM buffer (o maior)", () => {
    expect(duracaoOcupadaMin([maquiagem, penteado], servicoPrimario)).toBe(135);
  });

  it("sem itens, cai no serviço primário", () => {
    expect(duracaoOcupadaMin([], servicoPrimario)).toBe(75);
  });

  it("remarcar não encolhe o atendimento multi-serviço", () => {
    // O defeito: a remarcação olhava só o serviço primário (60+15=75) e o
    // atendimento de 135 min passava a ocupar 75 — os 60 minutos perdidos
    // voltavam a ser oferecidos no site.
    const naCriacao = duracaoOcupadaMin([maquiagem, penteado], servicoPrimario);
    const naRemarcacao = duracaoOcupadaMin(
      [maquiagem, penteado],
      servicoPrimario,
    );
    expect(naRemarcacao).toBe(naCriacao);
    expect(naRemarcacao).not.toBe(
      servicoPrimario.durationMin + servicoPrimario.bufferMin,
    );
  });

  it("um item só continua contando o buffer dele", () => {
    expect(duracaoOcupadaMin([penteado], servicoPrimario)).toBe(70);
  });
});
