import { describe, it, expect } from "vitest";
import { textoLocal } from "@/lib/notify-cliente";
import { aplicarTemplate, CONTENT_FIELDS } from "@/lib/content";

const tplConfirmacao = CONTENT_FIELDS.find(
  (f) => f.key === "msg.booking_confirmation",
)!;

describe("A9 — a confirmação diz onde é", () => {
  it("estúdio traz o endereço — a cliente não precisa perguntar", () => {
    const t = textoLocal("studio");
    expect(t).toContain("Ipoméia");
    expect(t).toContain("Santíssimo");
  });

  it("domicílio não expõe o endereço do estúdio", () => {
    const t = textoLocal("home");
    expect(t).not.toContain("Ipoméia");
    expect(t.toLowerCase()).toContain("até você");
  });
});

describe("A9 — template da confirmação", () => {
  it("aceita as cinco variáveis e não deixa placeholder cru", () => {
    const texto = aplicarTemplate(tplConfirmacao.default, {
      nome: "Carla",
      servico: "Design de sobrancelha",
      data: "13/06/2026 14:00",
      local: textoLocal("studio"),
      valor: "💛 Valor: R$ 36,00",
    });
    expect(texto).toContain("Carla");
    expect(texto).toContain("Design de sobrancelha");
    expect(texto).toContain("13/06/2026 14:00");
    expect(texto).toContain("Ipoméia");
    expect(texto).toContain("R$ 36,00");
    expect(texto).not.toMatch(/\{\w+\}/); // nenhuma chave sobrando
  });

  it("traz as orientações que a Mi sempre repete", () => {
    const t = tplConfirmacao.default.toLowerCase();
    expect(t).toContain("referências");
    expect(t).toContain("avise");
  });

  it("a ajuda do admin lista as variáveis disponíveis", () => {
    // Senão a Mi edita o texto no CMS e perde {local}/{valor} sem saber.
    for (const v of ["{nome}", "{servico}", "{data}", "{local}", "{valor}"]) {
      expect(tplConfirmacao.ajuda).toContain(v);
    }
  });
});
