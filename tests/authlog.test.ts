import { describe, it, expect } from "vitest";
import { clientIp, hashIp, maskPhone, metaFromHeaders } from "@/lib/authlog";

describe("clientIp — IP do request (LGPD: base p/ hash)", () => {
  it("pega o primeiro do x-forwarded-for (cadeia do Traefik)", () => {
    expect(clientIp("203.0.113.9, 10.0.0.1", null)).toBe("203.0.113.9");
  });
  it("faz trim e cai no x-real-ip quando não há forwarded", () => {
    expect(clientIp("", " 198.51.100.2 ")).toBe("198.51.100.2");
  });
  it("null quando não há nenhum", () => {
    expect(clientIp(null, null)).toBeNull();
    expect(clientIp(undefined, undefined)).toBeNull();
  });
});

describe("hashIp — nunca guardar IP cru", () => {
  it("é determinístico e SHA-256 (64 hex)", () => {
    const a = hashIp("203.0.113.9");
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(hashIp("203.0.113.9")).toBe(a);
    expect(hashIp("203.0.113.10")).not.toBe(a);
  });
});

describe("maskPhone — identificador da cliente sem PII completa", () => {
  it("mantém só os 4 últimos dígitos", () => {
    expect(maskPhone("+5521999887766")).toBe("••••7766");
    expect(maskPhone("(21) 99988-7766")).toBe("••••7766");
  });
  it("degrada com segurança em entrada curta", () => {
    expect(maskPhone("12")).toBe("••••");
  });
});

describe("metaFromHeaders — Fetch Headers e objeto plano", () => {
  it("extrai de um Headers real", () => {
    const h = new Headers({
      "x-forwarded-for": "203.0.113.9",
      "user-agent": "Safari",
    });
    expect(metaFromHeaders(h)).toEqual({ ip: "203.0.113.9", userAgent: "Safari" });
  });
  it("extrai de um Record simples (req do NextAuth)", () => {
    expect(
      metaFromHeaders({ "x-real-ip": "198.51.100.2", "user-agent": "Chrome" }),
    ).toEqual({ ip: "198.51.100.2", userAgent: "Chrome" });
  });
  it("vazio quando não há headers", () => {
    expect(metaFromHeaders(undefined)).toEqual({});
  });
});
