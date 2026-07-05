import { describe, it, expect } from "vitest";
import { crmConfigSchema, DEFAULT_CRM_CONFIG } from "@/lib/crm-config";
import { CONTENT_FIELDS } from "@/lib/content";

describe("funil 2.0 (F5)", () => {
  it("funilParadaDias tem default retrocompatível (config antiga sem a chave)", () => {
    const antiga = JSON.parse(JSON.stringify(DEFAULT_CRM_CONFIG)) as {
      limiares: Record<string, number>;
    };
    delete antiga.limiares.funilParadaDias;
    const parsed = crmConfigSchema.safeParse(antiga);
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.limiares.funilParadaDias).toBe(14);
  });

  it("todas as 6 etapas têm template de WhatsApp no CMS (editável pela Mi)", () => {
    const keys = CONTENT_FIELDS.map((f) => f.key);
    for (const etapa of [
      "lead",
      "previa_agendada",
      "previa_feita",
      "contrato_fechado",
      "evento",
      "pos_evento",
    ]) {
      expect(keys, `falta msg.funil_${etapa}`).toContain(`msg.funil_${etapa}`);
    }
  });
});
