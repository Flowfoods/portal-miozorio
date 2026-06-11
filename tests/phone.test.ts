import { describe, it, expect } from "vitest";
import { normalizeE164BR } from "@/lib/phone";

describe("normalizeE164BR (R5)", () => {
  it("normaliza celular do RJ em vários formatos", () => {
    expect(normalizeE164BR("(21) 97022-5231")).toBe("+5521970225231");
    expect(normalizeE164BR("21970225231")).toBe("+5521970225231");
    expect(normalizeE164BR("+55 21 97022-5231")).toBe("+5521970225231");
    expect(normalizeE164BR("5521970225231")).toBe("+5521970225231");
  });

  it("aceita fixo (10 dígitos)", () => {
    expect(normalizeE164BR("2122345678")).toBe("+552122345678");
  });

  it("rejeita números inválidos", () => {
    expect(normalizeE164BR("123")).toBeNull();
    expect(normalizeE164BR("00 99999-9999")).toBeNull(); // DDD inválido
    expect(normalizeE164BR("")).toBeNull();
  });
});
