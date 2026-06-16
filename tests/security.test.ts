import { describe, it, expect } from "vitest";
import {
  lockoutMs,
  LOCK_THRESHOLD,
  LOCK_BASE_MS,
  LOCK_MAX_MS,
  MIN_SENHA,
  generateResetToken,
  hashResetToken,
} from "@/lib/security";

describe("lockoutMs (bloqueio progressivo de login — M13.2)", () => {
  it("não trava antes do limite de tentativas", () => {
    for (let i = 0; i < LOCK_THRESHOLD; i++) {
      expect(lockoutMs(i)).toBe(0);
    }
  });

  it("trava com a duração base na primeira falha que atinge o limite", () => {
    expect(lockoutMs(LOCK_THRESHOLD)).toBe(LOCK_BASE_MS);
  });

  it("dobra a cada falha seguinte (backoff exponencial)", () => {
    expect(lockoutMs(LOCK_THRESHOLD + 1)).toBe(LOCK_BASE_MS * 2);
    expect(lockoutMs(LOCK_THRESHOLD + 2)).toBe(LOCK_BASE_MS * 4);
    expect(lockoutMs(LOCK_THRESHOLD + 3)).toBe(LOCK_BASE_MS * 8);
  });

  it("nunca passa do teto máximo, por mais tentativas que haja", () => {
    expect(lockoutMs(LOCK_THRESHOLD + 100)).toBe(LOCK_MAX_MS);
    expect(lockoutMs(9999)).toBe(LOCK_MAX_MS);
  });

  it("é monotônico não-decrescente", () => {
    let prev = -1;
    for (let n = 0; n <= 50; n++) {
      const cur = lockoutMs(n);
      expect(cur).toBeGreaterThanOrEqual(prev);
      prev = cur;
    }
  });
});

describe("política de senha (M13.1)", () => {
  it("exige senha forte de 12+ caracteres", () => {
    expect(MIN_SENHA).toBeGreaterThanOrEqual(12);
  });
});

describe("token de reset de senha (M13.4)", () => {
  it("hash é determinístico para o mesmo token", () => {
    const t = generateResetToken();
    expect(hashResetToken(t)).toBe(hashResetToken(t));
  });

  it("tokens diferentes geram hashes diferentes", () => {
    expect(hashResetToken(generateResetToken())).not.toBe(
      hashResetToken(generateResetToken()),
    );
  });

  it("o hash não é o token cru (nunca guardamos o valor em claro)", () => {
    const t = generateResetToken();
    expect(hashResetToken(t)).not.toBe(t);
    expect(hashResetToken(t)).toHaveLength(64); // sha-256 hex
  });

  it("gera tokens de alta entropia (não colidem)", () => {
    const tokens = new Set(
      Array.from({ length: 200 }, () => generateResetToken()),
    );
    expect(tokens.size).toBe(200);
  });
});
