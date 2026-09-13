import { describe, it, expect } from "vitest";
import { DateTime } from "luxon";
import { avaliarSinal, type SinalInput } from "@/lib/policies";

const TZ = "America/Sao_Paulo";
const mk = (iso: string) => DateTime.fromISO(iso, { zone: TZ });

/** Sábado 14:00; a cliente reserva na quarta de manhã (bem dentro do lead time). */
const base: SinalInput = {
  clienteExigeSinal: false,
  servicoExigeSinal: false,
  priceCents: 3600, // Design de sobrancelha, R$ 36 — o caso da Carla
  depositPercent: 20,
  now: mk("2026-06-10T09:00"),
  startsAt: mk("2026-06-13T14:00"),
  holdMinutes: 8,
  depositHoldHours: 24,
  depositCutoffHours: 2,
};

describe("A7 — sinal: quando é exigido", () => {
  it("serviço comum não exige sinal: hold curto de sempre", () => {
    const r = avaliarSinal(base);
    expect(r.precisaSinal).toBe(false);
    expect(r.depositCents).toBeNull();
    expect(r.holdExpiresAt.toISO()).toBe(mk("2026-06-10T09:08").toISO());
  });

  it("reincidência (3 cancelamentos) exige sinal — a via que continua valendo", () => {
    const r = avaliarSinal({ ...base, clienteExigeSinal: true });
    expect(r.precisaSinal).toBe(true);
    expect(r.depositCents).toBe(720); // 20% de R$ 36
  });

  it("flag manual do serviço exige sinal — a Mi pode ligar onde quiser", () => {
    const r = avaliarSinal({ ...base, servicoExigeSinal: true });
    expect(r.precisaSinal).toBe(true);
  });
});

describe("A7 — sinal: prazo para combinar", () => {
  it("com sinal o horário fica guardado 24h, não 8 minutos", () => {
    // O caso Carla: 8 minutos de hold com sinal exigido = reserva morta antes
    // de qualquer conversa acontecer.
    const r = avaliarSinal({ ...base, servicoExigeSinal: true });
    expect(r.holdExpiresAt.toISO()).toBe(mk("2026-06-11T09:00").toISO());
    expect(r.holdExpiresAt.diff(base.now, "hours").hours).toBe(24);
  });

  it("o prazo nunca passa do corte antes do atendimento", () => {
    // Reserva feita 3h antes: 24h cairia depois do atendimento. Vence às 12:00
    // (14:00 menos o corte de 2h), não às 11:00 do dia seguinte.
    const r = avaliarSinal({
      ...base,
      servicoExigeSinal: true,
      now: mk("2026-06-13T11:00"),
    });
    expect(r.holdExpiresAt.toISO()).toBe(mk("2026-06-13T12:00").toISO());
  });

  it("prazo nunca nasce no passado, mesmo com lead time menor que o corte", () => {
    // Encaixe 1h antes: o corte de 2h jogaria o prazo para trás. O piso do hold
    // padrão segura — senão a reserva nasceria vencida e o cron a mataria na
    // primeira passada.
    const r = avaliarSinal({
      ...base,
      servicoExigeSinal: true,
      now: mk("2026-06-13T13:00"),
    });
    expect(r.holdExpiresAt > base.now).toBe(true);
    expect(r.holdExpiresAt.toISO()).toBe(mk("2026-06-13T13:08").toISO());
  });
});

describe("A7 — sinal: cálculo do valor", () => {
  it("arredonda para o centavo mais próximo", () => {
    const r = avaliarSinal({
      ...base,
      servicoExigeSinal: true,
      priceCents: 12345,
      depositPercent: 20,
    });
    expect(r.depositCents).toBe(2469); // 2469,0 exato
  });

  it("percentual configurável (R3) — 50% muda o valor", () => {
    const r = avaliarSinal({
      ...base,
      servicoExigeSinal: true,
      depositPercent: 50,
    });
    expect(r.depositCents).toBe(1800);
  });
});
