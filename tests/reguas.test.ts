import { describe, it, expect } from "vitest";
import { dedupKeyRegua, REGUA_KIND, REGUA_LABEL } from "@/lib/reguas";
import { crmConfigSchema, DEFAULT_CRM_CONFIG } from "@/lib/crm-config";
import { aplicarTemplate } from "@/lib/content";

describe("réguas F4 — regra da casa: sugerir, nunca enviar", () => {
  it("dedup mensal muda por mês e por régua (R10)", () => {
    const jan = new Date("2026-01-10T12:00:00Z");
    const fev = new Date("2026-02-10T12:00:00Z");
    expect(dedupKeyRegua("sumida", "abc", jan)).toBe("regua_sumida:abc:2026-01");
    expect(dedupKeyRegua("sumida", "abc", fev)).toBe("regua_sumida:abc:2026-02");
    expect(dedupKeyRegua("abandono", "abc", jan)).not.toBe(
      dedupKeyRegua("leadFria", "abc", jan),
    );
  });

  it("todo kind de régua e de jornada tem rótulo leigo (R13)", () => {
    for (const kind of Object.values(REGUA_KIND)) {
      expect(REGUA_LABEL[kind]).toBeTruthy();
    }
    for (const g of ["boas_vindas", "manutencao", "reativacao"]) {
      expect(REGUA_LABEL[g]).toBeTruthy();
    }
  });

  it("templates default renderizam {nome} e {dias}", () => {
    const t = DEFAULT_CRM_CONFIG.reguas.templates.sumida;
    const out = aplicarTemplate(t, { nome: "Ana", dias: "120" });
    expect(out).toContain("Ana");
    expect(out).toContain("120");
    expect(out).not.toContain("{");
  });

  it("réguas nascem DESLIGADAS (nada dispara sem a Mi ligar)", () => {
    expect(DEFAULT_CRM_CONFIG.reguas.ativas).toEqual({
      sumida: false,
      abandono: false,
      leadFria: false,
    });
  });

  it("config antiga (sem reguas) continua válida — default retrocompatível", () => {
    const antiga = JSON.parse(JSON.stringify(DEFAULT_CRM_CONFIG)) as Record<
      string,
      unknown
    >;
    delete antiga.reguas;
    const parsed = crmConfigSchema.safeParse(antiga);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.reguas.intervaloPorClienteDias).toBe(7);
    }
  });
});
