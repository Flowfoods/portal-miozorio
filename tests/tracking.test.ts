import { describe, it, expect } from "vitest";
import { sanitizeMeta, CLIENT_EMITTABLE, EV } from "@/lib/tracking";

describe("sanitizeMeta — nunca deixa passar PII/dado de saúde (R18)", () => {
  it("descarta chaves sensíveis (alergia, email, telefone, nome, cpf, senha)", () => {
    const out = sanitizeMeta({
      alergia: "penicilina",
      email: "a@b.com",
      telefone: "+5521999999999",
      nome: "Fulana",
      cpf: "12345678900",
      senha: "hunter2",
      servico: "escova", // não sensível → mantém
    });
    expect(out).toEqual({ servico: "escova" });
  });

  it("mantém só primitivos e limita tamanho de string", () => {
    const out = sanitizeMeta({
      servico: "x".repeat(500),
      quantidade: 3,
      ativo: true,
      obj: { a: 1 },
      arr: [1, 2],
      nulo: null,
    });
    expect((out?.servico as string).length).toBe(200);
    expect(out?.quantidade).toBe(3);
    expect(out?.ativo).toBe(true);
    expect(out).not.toHaveProperty("obj");
    expect(out).not.toHaveProperty("arr");
    expect(out).not.toHaveProperty("nulo");
  });

  it("respeita o teto de chaves e devolve undefined para vazio", () => {
    const many: Record<string, number> = {};
    for (let i = 0; i < 30; i++) many[`k${i}`] = i;
    expect(Object.keys(sanitizeMeta(many) ?? {}).length).toBe(12);
    expect(sanitizeMeta({})).toBeUndefined();
    expect(sanitizeMeta(null)).toBeUndefined();
    expect(sanitizeMeta("texto")).toBeUndefined();
  });
});

describe("CLIENT_EMITTABLE — beacon do cliente não forja eventos de servidor", () => {
  it("aceita os tipos observáveis no cliente", () => {
    expect(CLIENT_EMITTABLE.has(EV.SESSAO_INICIADA)).toBe(true);
    expect(CLIENT_EMITTABLE.has(EV.VISUALIZOU_AGENDAMENTO)).toBe(true);
    expect(CLIENT_EMITTABLE.has(EV.INICIOU_AGENDAMENTO)).toBe(true);
    expect(CLIENT_EMITTABLE.has(EV.ABANDONOU_AGENDAMENTO)).toBe(true);
  });

  it("recusa os tipos server-authoritative", () => {
    expect(CLIENT_EMITTABLE.has(EV.AGENDAMENTO_CONCLUIDO)).toBe(false);
    expect(CLIENT_EMITTABLE.has(EV.LOGIN_CLUBE)).toBe(false);
    expect(CLIENT_EMITTABLE.has(EV.RESGATE_REALIZADO)).toBe(false);
  });
});
