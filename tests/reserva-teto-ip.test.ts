import { describe, it, expect } from "vitest";
import {
  EVENTOS_FORA_DOS_ACESSOS,
  RESERVA_IP_MAX,
  RESERVA_IP_WINDOW_MS,
  esperaDeReservaPorIp,
} from "@/lib/authlog";

/**
 * Teto de reservas por IP na rota pública de agendamento.
 *
 * O teto por telefone (`MAX_PENDING_POR_TELEFONE`) barra o abuso realista, mas
 * não alcança quem troca o telefone a cada POST — e cada reserva nova segura um
 * horário durante todo o hold. Aqui mora a parte que dá para testar sem banco:
 * a janela deslizante.
 */

const AGORA = new Date("2026-09-14T15:00:00Z");

/** `n` criações espaçadas de 1 min, a mais nova primeiro (como vem do banco). */
function criacoes(n: number, desdeMs = 60_000): Date[] {
  return Array.from(
    { length: n },
    (_, i) => new Date(AGORA.getTime() - (i + 1) * desdeMs),
  );
}

describe("esperaDeReservaPorIp — janela deslizante", () => {
  it("IP sem nenhuma reserva passa", () => {
    expect(esperaDeReservaPorIp([], AGORA)).toEqual({
      bloqueado: false,
      minutos: 0,
    });
  });

  it("uma abaixo do teto ainda passa", () => {
    expect(
      esperaDeReservaPorIp(criacoes(RESERVA_IP_MAX - 1), AGORA).bloqueado,
    ).toBe(false);
  });

  it("no teto, bloqueia e diz quantos minutos faltam", () => {
    const r = esperaDeReservaPorIp(criacoes(RESERVA_IP_MAX), AGORA);
    expect(r.bloqueado).toBe(true);
    expect(r.minutos).toBeGreaterThan(0);
    // Nunca é bloqueio "para sempre": cai quando a N-ésima sai da janela.
    expect(r.minutos).toBeLessThanOrEqual(RESERVA_IP_WINDOW_MS / 60_000);
  });

  it("reservas velhas não contam — a janela anda", () => {
    // Todas antes da janela: um IP que marcou muito ontem não fica marcado.
    const velhas = Array.from(
      { length: RESERVA_IP_MAX * 2 },
      (_, i) => new Date(AGORA.getTime() - RESERVA_IP_WINDOW_MS - i * 60_000),
    );
    expect(esperaDeReservaPorIp(velhas, AGORA).bloqueado).toBe(false);
  });

  it("o bloqueio cede sozinho com o passar do tempo", () => {
    const lote = criacoes(RESERVA_IP_MAX);
    expect(esperaDeReservaPorIp(lote, AGORA).bloqueado).toBe(true);
    const depois = new Date(AGORA.getTime() + RESERVA_IP_WINDOW_MS);
    expect(esperaDeReservaPorIp(lote, depois).bloqueado).toBe(false);
  });

  it("reserva criada não polui a tela de Acessos, mas o bloqueio aparece", () => {
    // A tela "Acessos & segurança" lista os últimos 100 eventos sem filtro. Uma
    // reserva criada acompanha o movimento normal do site e empurraria as
    // entradas e tentativas para fora da tela; o bloqueio é raro e é o sinal
    // que a Mi precisa ver.
    expect(EVENTOS_FORA_DOS_ACESSOS).toContain("booking_create");
    expect(EVENTOS_FORA_DOS_ACESSOS).not.toContain("booking_throttled");
  });

  it("o teto é folgado por causa do CGNAT das operadoras", () => {
    // Muita cliente atrás do mesmo IP é o caso normal no celular. O número
    // existe para transformar centenas de horários travados em dez, não para
    // policiar quem marca duas vezes.
    expect(RESERVA_IP_MAX).toBeGreaterThanOrEqual(10);
    expect(RESERVA_IP_WINDOW_MS).toBe(60 * 60_000);
  });
});
