import { describe, it, expect } from "vitest";
import {
  esperaPorIdentificador,
  IDENT_MAX_FAILS,
  IDENT_WINDOW_MS,
  IP_MAX_FAILS,
  IP_WINDOW_MS,
} from "@/lib/authlog";
import {
  BCRYPT_ROUNDS,
  hashFraco,
  lockoutMs,
  LOCK_THRESHOLD,
} from "@/lib/security";
import { MAX_PEDIDOS_HORA, MAX_TENTATIVAS } from "@/lib/recuperacao";

/** B4 — rate limit, força do hash e invalidação de sessão. */

const min = (n: number) => new Date(Date.now() - n * 60_000);

describe("B4 — rate limit de login por identificador (10 / 15 min)", () => {
  it("os parâmetros são os combinados", () => {
    expect(IDENT_MAX_FAILS).toBe(10);
    expect(IDENT_WINDOW_MS).toBe(15 * 60_000);
  });

  it("libera enquanto não chega ao limite", () => {
    const falhas = Array.from({ length: 9 }, (_, i) => min(i));
    expect(esperaPorIdentificador(falhas).bloqueado).toBe(false);
  });

  it("bloqueia na 10ª falha da janela", () => {
    const falhas = Array.from({ length: 10 }, (_, i) => min(i));
    expect(esperaPorIdentificador(falhas).bloqueado).toBe(true);
  });

  it("sempre diz quanto falta — nunca bloqueio silencioso", () => {
    // 10 falhas, a mais antiga há 5 min → destrava em ~10 min.
    const falhas = Array.from({ length: 10 }, (_, i) => min(i * 0.5));
    const r = esperaPorIdentificador(falhas);
    expect(r.bloqueado).toBe(true);
    expect(r.minutos).toBeGreaterThan(0);
    expect(r.minutos).toBeLessThanOrEqual(15);
  });

  it("falhas fora da janela não contam (o bloqueio sempre passa)", () => {
    const antigas = Array.from({ length: 30 }, (_, i) => min(20 + i));
    expect(esperaPorIdentificador(antigas).bloqueado).toBe(false);
  });

  it("não se importa com a ordem em que as falhas chegam", () => {
    const falhas = Array.from({ length: 10 }, (_, i) => min(i)).reverse();
    expect(esperaPorIdentificador(falhas).bloqueado).toBe(true);
  });
});

describe("B4 — as outras travas continuam de pé", () => {
  it("trava por conta com backoff a partir da 5ª falha", () => {
    expect(lockoutMs(LOCK_THRESHOLD - 1)).toBe(0);
    expect(lockoutMs(LOCK_THRESHOLD)).toBeGreaterThan(0);
  });

  it("rate limit por IP é mais folgado (IP pode ser compartilhado)", () => {
    expect(IP_MAX_FAILS).toBeGreaterThan(IDENT_MAX_FAILS);
    expect(IP_WINDOW_MS).toBe(15 * 60_000);
  });

  it("5 tentativas por código e 3 pedidos por hora", () => {
    expect(MAX_TENTATIVAS).toBe(5);
    expect(MAX_PEDIDOS_HORA).toBe(3);
  });
});

describe("B4 — hash de senha", () => {
  it("o padrão do portal é bcrypt com custo 12", () => {
    expect(BCRYPT_ROUNDS).toBe(12);
  });

  it("reconhece hash com custo menor que o atual (migra no próximo login)", () => {
    expect(hashFraco("$2a$10$abcdefghijklmnopqrstuv")).toBe(true);
    expect(hashFraco("$2b$08$abcdefghijklmnopqrstuv")).toBe(true);
  });

  it("hash no padrão atual (ou mais forte) não é remexido", () => {
    expect(hashFraco("$2a$12$abcdefghijklmnopqrstuv")).toBe(false);
    expect(hashFraco("$2b$14$abcdefghijklmnopqrstuv")).toBe(false);
  });

  it("o que não é bcrypt conta como fraco e sobe no primeiro login certo", () => {
    expect(hashFraco("5f4dcc3b5aa765d61d8327deb882cf99")).toBe(true);
  });

  it("sem hash (senha provisória = telefone) não há o que migrar", () => {
    expect(hashFraco(null)).toBe(false);
    expect(hashFraco("")).toBe(false);
  });
});
