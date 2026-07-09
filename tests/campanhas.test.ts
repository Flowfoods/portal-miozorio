import { describe, it, expect } from "vitest";
import { buildSegmentoWhere } from "@/lib/campanhas/segmento";
import { linkAgenda, renderCampanha, temLinkBooking } from "@/lib/campanhas/template";
import type { ClienteSegmento } from "@/lib/campanhas/segmento";

const cli = (over: Partial<ClienteSegmento> = {}): ClienteSegmento => ({
  id: "1",
  nome: "Ana Paula Souza",
  telefone: "+5521999998888",
  servicoUltimo: "Maquiagem social",
  diasSemVir: 72,
  pontosClube: 120,
  funil: false,
  ...over,
});

const O = { siteUrl: "https://miozorio.com.br", waMi: "https://wa.me/5521970225231" };

describe("buildSegmentoWhere — filtros e segurança", () => {
  it("por padrão exige telefone e respeita opt-out", () => {
    const w = buildSegmentoWhere({});
    expect(w).toContain("c.phone_e164 IS NOT NULL");
    expect(w).toContain("c.aceita_marketing = true");
  });
  it("apenasOptIn=false remove o filtro de marketing", () => {
    expect(buildSegmentoWhere({ apenasOptIn: false })).not.toContain("aceita_marketing");
  });
  it("inatividade vira INTERVAL com inteiro", () => {
    expect(buildSegmentoWhere({ inatividadeDias: 60 })).toContain("INTERVAL '60 days'");
  });
  it("dias malicioso é descartado (não vira SQL)", () => {
    const w = buildSegmentoWhere({ inatividadeDias: "60; DROP TABLE" as unknown as number });
    expect(w).not.toContain("DROP");
    expect(w).not.toContain("INTERVAL");
  });
  it("fezServico só aceita códigos válidos; injeção é ignorada", () => {
    expect(buildSegmentoWhere({ fezServico: ["maquiagem-social"] })).toContain("'maquiagem-social'");
    const w = buildSegmentoWhere({ fezServico: ["x'; DROP--"] });
    expect(w).not.toContain("DROP");
    expect(w).not.toContain("s.code IN");
  });
  it("rfv escapa aspas", () => {
    expect(buildSegmentoWhere({ rfvSegmentos: ["Em risco"] })).toContain("'Em risco'");
  });
});

describe("REGRA INVIOLÁVEL — noiva/debutante nunca recebe link de booking", () => {
  it("linkAgenda de funil vira WhatsApp, não /agendar", () => {
    expect(linkAgenda({ funil: true }, O)).toBe(O.waMi);
    expect(linkAgenda({ funil: false }, O)).toContain("/agendar");
  });
  it("mensagem renderizada p/ funil não contém /agendar", () => {
    const corpo = "Oi {nome}! Vamos marcar sua prévia? {link_agenda}";
    const txt = renderCampanha(corpo, cli({ funil: true }), O);
    expect(temLinkBooking(txt)).toBe(false);
    expect(txt).toContain(O.waMi);
  });
  it("cliente normal recebe o deep link de agenda", () => {
    const txt = renderCampanha("Bora? {link_agenda}", cli({ funil: false }), O);
    expect(temLinkBooking(txt)).toBe(true);
  });
});

describe("render de variáveis", () => {
  it("interpola nome (1º nome), dias, pontos", () => {
    const txt = renderCampanha(
      "{nome}, faz {dias_sem_vir} dias, você tem {pontos_clube} pontos",
      cli(),
      O,
    );
    expect(txt).toBe("Ana, faz 72 dias, você tem 120 pontos");
  });
});
