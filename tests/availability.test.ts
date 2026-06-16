import { describe, it, expect } from "vitest";
import { buildServiceHours } from "@/lib/availability";

describe("buildServiceHours (M9 — disponibilidade por serviço)", () => {
  it("lista vazia vira objeto vazio (cai no global)", () => {
    expect(buildServiceHours([])).toEqual({});
  });

  it("mapeia weekday 1..7 para seg..dom", () => {
    const wh = buildServiceHours([
      { weekday: 2, startTime: "09:00", endTime: "18:00" },
      { weekday: 6, startTime: "10:00", endTime: "16:00" },
    ]);
    expect(wh).toEqual({
      tue: [["09:00", "18:00"]],
      sat: [["10:00", "16:00"]],
    });
  });

  it("agrupa e ordena várias janelas do mesmo dia", () => {
    const wh = buildServiceHours([
      { weekday: 3, startTime: "14:00", endTime: "18:00" },
      { weekday: 3, startTime: "09:00", endTime: "12:00" },
    ]);
    expect(wh.wed).toEqual([
      ["09:00", "12:00"],
      ["14:00", "18:00"],
    ]);
  });

  it("ignora weekday inválido", () => {
    expect(buildServiceHours([{ weekday: 0, startTime: "09:00", endTime: "18:00" }])).toEqual({});
    expect(buildServiceHours([{ weekday: 8, startTime: "09:00", endTime: "18:00" }])).toEqual({});
  });
});
