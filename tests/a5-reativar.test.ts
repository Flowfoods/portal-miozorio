import { describe, it, expect } from "vitest";
import { statusLabel, statusStyle } from "@/components/admin/bookingStatus";
import { historiaDoAgendamento } from "@/lib/booking-historia";

describe("A5 — a tela para de acusar a Mi", () => {
  it("hold vencido pelo cron: 'Expirado (sistema)', nunca 'Cancelado (Mi)'", () => {
    expect(statusLabel("cancelled_by_business", "SYSTEM")).toBe(
      "Expirado (sistema)",
    );
  });

  it("cancelamento de verdade dela continua 'Cancelado (Mi)'", () => {
    expect(statusLabel("cancelled_by_business", "ADMIN")).toBe("Cancelado (Mi)");
  });

  it("cancelamento da cliente não muda", () => {
    expect(statusLabel("cancelled_by_client", "CLIENT")).toBe(
      "Cancelado (cliente)",
    );
  });

  it("reserva antiga sem a coluna preenchida cai no rótulo de sempre", () => {
    // Retrocompatibilidade: a migration faz backfill, mas nada pode quebrar se
    // vier null.
    expect(statusLabel("cancelled_by_business", null)).toBe("Cancelado (Mi)");
    expect(statusLabel("cancelled_by_business", undefined)).toBe(
      "Cancelado (Mi)",
    );
  });

  it("cancelledBy não contamina status que não são de cancelamento", () => {
    expect(statusLabel("confirmed", "SYSTEM")).toBe("Confirmado");
    expect(statusLabel("completed", "ADMIN")).toBe("Concluído");
    expect(statusLabel("pending", "CLIENT")).toBe("Pendente");
  });

  it("expirado usa tom neutro, não o vermelho de cancelamento", () => {
    // Um horário que voltou pra agenda não é erro de ninguém.
    expect(statusStyle("cancelled_by_business", "SYSTEM")).not.toContain(
      "mi-erro",
    );
    expect(statusStyle("cancelled_by_business", "ADMIN")).toContain("mi-erro");
  });
});

describe("A5 — histórico conta o que aconteceu", () => {
  it("reativação aparece como reativação", () => {
    expect(
      historiaDoAgendamento({
        toStatus: "confirmed",
        actor: "admin",
        reason: "reativado_pela_mi",
      }),
    ).toBe("Você reativou este horário");
  });

  it("confirmar pulando o sinal fica registrado como dispensa", () => {
    expect(
      historiaDoAgendamento({
        toStatus: "confirmed",
        actor: "business",
        reason: "sinal_dispensado_pela_mi",
      }),
    ).toBe("Você confirmou sem exigir o sinal");
  });

  it("confirmação comum segue como antes", () => {
    expect(
      historiaDoAgendamento({
        toStatus: "confirmed",
        actor: "business",
        reason: null,
      }),
    ).toBe("Você confirmou");
  });

  it("a frase do caso Carla continua valendo", () => {
    expect(
      historiaDoAgendamento({
        toStatus: "cancelled_by_business",
        actor: "system",
        reason: "reserva_nao_concluida",
      }),
    ).toBe("O horário venceu sem a cliente concluir");
  });
});
