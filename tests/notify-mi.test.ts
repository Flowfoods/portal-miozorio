import { describe, it, expect } from "vitest";
import { montarMensagemMi, numeroDaMi, type DadosMi } from "@/lib/notify-mi";

/** Sábado 13/06/2026, 14:00 em São Paulo. */
const base: DadosMi = {
  customerId: "11111111-1111-1111-1111-111111111111",
  clienteNome: "Carla",
  clienteTelefone: "+5521999998888",
  servico: "Design de sobrancelha",
  startsAt: new Date("2026-06-13T17:00:00.000Z"), // 14:00 BRT
  location: "studio",
  priceCents: 3600,
};

describe("A4 — mensagem para a Mi", () => {
  it("traz tudo que ela precisa para agir sem abrir o painel", () => {
    const m = montarMensagemMi("nova_reserva", base);
    expect(m).toContain("Carla");
    expect(m).toContain("+5521999998888");
    expect(m).toContain("Design de sobrancelha");
    expect(m).toContain("14:00");
    expect(m).toContain("13/06");
    expect(m).toContain("No estúdio");
    expect(m).toContain("36,00");
  });

  it("termina com o link direto da ficha no admin", () => {
    const m = montarMensagemMi("nova_reserva", base);
    expect(m.trim().endsWith(`/admin/clientes/${base.customerId}`)).toBe(true);
  });

  it("domicílio aparece como domicílio", () => {
    const m = montarMensagemMi("nova_reserva", { ...base, location: "home" });
    expect(m).toContain("Em domicílio");
  });

  it("multi-serviço mostra os dois nomes", () => {
    const m = montarMensagemMi("nova_reserva", {
      ...base,
      servico: "Escova + Design de sobrancelha",
    });
    expect(m).toContain("Escova + Design de sobrancelha");
  });

  describe("cada evento tem um título próprio", () => {
    const casos = [
      ["nova_reserva", "Novo agendamento"],
      ["aguardando_sinal", "aguardando sinal"],
      ["sinal_pago", "Sinal recebido"],
      ["confirmado", "confirmado"],
      ["cancelado_cliente", "cliente cancelou"],
      ["expirado", "expirou"],
    ] as const;
    for (const [evento, trecho] of casos) {
      it(`${evento} → "${trecho}"`, () => {
        expect(montarMensagemMi(evento, base)).toContain(trecho);
      });
    }
  });

  it("aguardando sinal diz o valor e até quando o horário fica guardado", () => {
    const m = montarMensagemMi("aguardando_sinal", {
      ...base,
      depositCents: 720,
      holdExpiresAt: new Date("2026-06-12T17:00:00.000Z"), // 14:00 BRT do dia 12
    });
    expect(m).toContain("7,20");
    expect(m).toContain("12/06");
  });

  it("expirado explica que dá para reativar — a Mi achava que tinha perdido", () => {
    const m = montarMensagemMi("expirado", base);
    expect(m).toContain("voltou para a agenda");
    expect(m.toLowerCase()).toContain("reativar");
  });

  it("número da Mi sai só com dígitos, venha como URL ou como número", () => {
    // WHATSAPP_MI no .env.example é a URL do wa.me.
    expect(numeroDaMi()).toMatch(/^\d+$/);
  });
});
