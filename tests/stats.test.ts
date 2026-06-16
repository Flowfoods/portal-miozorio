import { describe, it, expect } from "vitest";
import { DateTime } from "luxon";
import {
  windowMinutes,
  availableMinutesInRange,
  bucketSource,
  computeResumo,
  monthRange,
  type ResumoBooking,
} from "@/lib/stats";

const ZONE = "America/Sao_Paulo";

const mk = (
  status: string,
  priceCents: number,
  source: string,
  durMin: number,
  serviceName: string,
): ResumoBooking => {
  const startsAt = new Date("2026-06-10T12:00:00Z");
  return {
    status,
    priceCents,
    source,
    startsAt,
    endsAt: new Date(startsAt.getTime() + durMin * 60000),
    serviceName,
  };
};

describe("windowMinutes", () => {
  it("calcula a duração da janela", () => {
    expect(windowMinutes("09:00", "19:00")).toBe(600);
    expect(windowMinutes("13:30", "14:00")).toBe(30);
  });
  it("formato inválido vira 0", () => {
    expect(windowMinutes("9h", "19h")).toBe(0);
    expect(windowMinutes("19:00", "09:00")).toBe(0); // fim < início
  });
});

describe("availableMinutesInRange", () => {
  const wh = { sat: [["09:00", "19:00"]], sun: [["09:00", "19:00"]] } as Record<
    string,
    [string, string][]
  >;
  it("uma semana cheia tem exatamente 1 sáb + 1 dom (1200 min)", () => {
    const start = DateTime.fromISO("2026-06-01T00:00:00", { zone: ZONE });
    const end = start.plus({ days: 7 });
    expect(
      availableMinutesInRange(wh, start.toMillis(), end.toMillis(), ZONE),
    ).toBe(1200);
  });
  it("intervalo vazio = 0", () => {
    const t = DateTime.fromISO("2026-06-01T00:00:00", { zone: ZONE }).toMillis();
    expect(availableMinutesInRange(wh, t, t, ZONE)).toBe(0);
  });
});

describe("bucketSource", () => {
  it("web = site; resto = telefone", () => {
    expect(bucketSource("web")).toBe("site");
    expect(bucketSource("whatsapp")).toBe("telefone");
    expect(bucketSource("manual")).toBe("telefone");
  });
});

describe("computeResumo", () => {
  const bookings: ResumoBooking[] = [
    mk("completed", 30000, "web", 60, "Maquiagem social"),
    mk("completed", 50000, "whatsapp", 90, "Penteado"),
    mk("completed", 30000, "manual", 60, "Maquiagem social"),
    mk("no_show", 30000, "web", 60, "Maquiagem social"),
    mk("cancelled_by_client", 30000, "web", 60, "Penteado"),
    mk("confirmed", 40000, "web", 120, "Curso"),
  ];
  const r = computeResumo(bookings, 660);

  it("faturamento e atendimentos só de completed", () => {
    expect(r.atendimentos).toBe(3);
    expect(r.faturamentoCents).toBe(110000);
  });
  it("ticket médio", () => {
    expect(r.ticketMedioCents).toBe(Math.round(110000 / 3));
  });
  it("no-show e taxa (sobre completed + no_show)", () => {
    expect(r.noShow).toBe(1);
    expect(r.noShowRate).toBeCloseTo(0.25, 5);
  });
  it("cancelamentos", () => {
    expect(r.canceladas).toBe(1);
  });
  it("ocupação = minutos reservados (confirmed+completed) / disponíveis", () => {
    // 60+90+60+120 = 330 reservados / 660 = 0.5
    expect(r.ocupacao).toBeCloseTo(0.5, 5);
  });
  it("top serviços ordenado por faturamento", () => {
    expect(r.topServicos[0]).toMatchObject({
      nome: "Maquiagem social",
      atendimentos: 2,
      faturamentoCents: 60000,
    });
    expect(r.topServicos[1]?.nome).toBe("Penteado");
  });
  it("origem site x telefone (só completed)", () => {
    expect(r.origem.site).toMatchObject({ atendimentos: 1, faturamentoCents: 30000 });
    expect(r.origem.telefone).toMatchObject({ atendimentos: 2, faturamentoCents: 80000 });
  });
  it("não estoura com lista vazia", () => {
    const z = computeResumo([], 0);
    expect(z.faturamentoCents).toBe(0);
    expect(z.ticketMedioCents).toBe(0);
    expect(z.noShowRate).toBe(0);
    expect(z.ocupacao).toBe(0);
  });
});

describe("monthRange", () => {
  const now = DateTime.fromISO("2026-06-15T10:00:00", { zone: ZONE });
  it("mês explícito YYYY-MM", () => {
    const { start, end, label } = monthRange("2026-06", now);
    expect(start.toFormat("yyyy-MM-dd")).toBe("2026-06-01");
    expect(end.toFormat("yyyy-MM-dd")).toBe("2026-07-01");
    expect(label.toLowerCase()).toContain("junho");
  });
  it("sem parâmetro usa o mês de agora", () => {
    expect(monthRange(undefined, now).start.toFormat("yyyy-MM")).toBe("2026-06");
  });
  it("lixo cai no mês atual", () => {
    expect(monthRange("xxxx", now).start.toFormat("yyyy-MM")).toBe("2026-06");
  });
});
