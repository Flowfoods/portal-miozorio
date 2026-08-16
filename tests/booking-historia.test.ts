import { describe, it, expect } from "vitest";
import { historiaDoAgendamento } from "@/lib/booking-historia";

describe("história do agendamento — a agenda para de acusar a Mi", () => {
  it("reserva expirada pelo sistema NÃO vira 'você cancelou'", () => {
    // O caso que motivou tudo: status cru é cancelled_by_business, e a tela
    // mostrava "Cancelado (Mi)" para algo que a Mi nunca tocou.
    const frase = historiaDoAgendamento({
      toStatus: "cancelled_by_business",
      actor: "system",
      reason: "reserva_nao_concluida",
    });
    expect(frase).toBe("O horário venceu sem a cliente concluir");
    expect(frase).not.toMatch(/você/i);
  });

  it("cancelamento real da Mi continua sendo dela", () => {
    expect(
      historiaDoAgendamento({
        toStatus: "cancelled_by_business",
        actor: "admin",
        reason: null,
      }),
    ).toBe("Você cancelou");
  });

  it("distingue cancelamento da cliente dentro e fora do prazo", () => {
    expect(
      historiaDoAgendamento({
        toStatus: "cancelled_by_client",
        actor: "customer",
        reason: null,
      }),
    ).toBe("A cliente cancelou");
    expect(
      historiaDoAgendamento({
        toStatus: "cancelled_by_client",
        actor: "client",
        reason: "fora_do_prazo_sinal_retido",
      }),
    ).toBe("A cliente cancelou em cima da hora");
  });

  it("trata 'client' e 'customer' como o mesmo ator", () => {
    // Os dois valores são gravados por caminhos diferentes do código; se a
    // leitura não normalizar, o mesmo fato aparece de dois jeitos na tela.
    const a = historiaDoAgendamento({
      toStatus: "confirmed",
      actor: "client",
      reason: null,
    });
    const b = historiaDoAgendamento({
      toStatus: "confirmed",
      actor: "customer",
      reason: null,
    });
    expect(a).toBe(b);
    expect(a).toBe("A cliente confirmou");
  });

  it("encaixe manual aparece; agendamento comum não polui a tela", () => {
    expect(
      historiaDoAgendamento({
        toStatus: "pending",
        actor: "admin",
        reason: "encaixe_manual",
      }),
    ).toBe("Encaixe feito por você");
    expect(
      historiaDoAgendamento({
        toStatus: "pending",
        actor: "customer",
        reason: null,
      }),
    ).toBeNull();
  });

  it("sem evento, não inventa frase", () => {
    expect(historiaDoAgendamento(null)).toBeNull();
    expect(historiaDoAgendamento(undefined)).toBeNull();
  });
});
