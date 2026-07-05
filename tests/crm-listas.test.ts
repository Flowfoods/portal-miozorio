import { describe, it, expect } from "vitest";
import { EVENTO_LABEL } from "@/lib/crm-listas";
import { EV } from "@/lib/tracking";
import { waLinkMsg } from "@/lib/format";

describe("EVENTO_LABEL — todo evento tem rótulo leigo (R13)", () => {
  it("cobre 100% dos tipos de evento", () => {
    for (const tipo of Object.values(EV)) {
      expect(EVENTO_LABEL[tipo], `sem rótulo para ${tipo}`).toBeTruthy();
    }
  });
  it("nenhum rótulo usa jargão", () => {
    for (const label of Object.values(EVENTO_LABEL)) {
      expect(label.toLowerCase()).not.toMatch(/slot|booking|lead|tracking/);
    }
  });
});

describe("waLinkMsg — link de WhatsApp com rascunho", () => {
  it("codifica a mensagem e mantém só dígitos no telefone", () => {
    const url = waLinkMsg("+5521970225231", "Oi Ana! 💛");
    expect(url).toContain("wa.me/5521970225231");
    expect(url).toContain("?text=Oi%20Ana!%20%F0%9F%92%9B");
  });
});
