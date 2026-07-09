import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock do prisma: create lança em dedupeKey repetido (simula UNIQUE do banco).
const store = new Set<string>();
vi.mock("@/lib/prisma", () => ({
  prisma: {
    whatsAppMessage: {
      create: vi.fn(async ({ data }: { data: { dedupeKey: string } }) => {
        if (store.has(data.dedupeKey)) throw new Error("unique violation");
        store.add(data.dedupeKey);
        return { id: `id-${data.dedupeKey}` };
      }),
    },
  },
}));

import {
  backoffMs,
  proximoEstado,
  bloqueadaPorOptOut,
  isOptOutReply,
  enqueue,
  MAX_TENTATIVAS,
} from "@/lib/whatsapp/service";

beforeEach(() => store.clear());

describe("idempotência do dedupeKey", () => {
  it("mesma dedupeKey enfileira 1×; a 2ª volta null", async () => {
    const base = {
      telefone: "+5521999998888",
      texto: "oi 💛",
      tipo: "TRANSACIONAL" as const,
      dedupeKey: "lembrete24h:abc",
    };
    const primeiro = await enqueue(base);
    const segundo = await enqueue(base);
    expect(primeiro).toBeTruthy();
    expect(segundo).toBeNull();
  });
});

describe("retry com backoff", () => {
  it("backoff cresce (1,2,4 min) e tem teto de 1h", () => {
    expect(backoffMs(1)).toBe(60_000);
    expect(backoffMs(2)).toBe(120_000);
    expect(backoffMs(3)).toBe(240_000);
    expect(backoffMs(99)).toBe(3_600_000);
  });
  it("sucesso → SENT", () => {
    expect(proximoEstado(0, true)).toEqual({ status: "SENT", proximaTentativa: null });
  });
  it("falha antes do teto → QUEUED com próxima tentativa no futuro", () => {
    const r = proximoEstado(0, false);
    expect(r.status).toBe("QUEUED");
    expect(r.proximaTentativa!.getTime()).toBeGreaterThan(Date.now());
  });
  it("falha na última tentativa → FAILED (sem retry)", () => {
    const r = proximoEstado(MAX_TENTATIVAS - 1, false);
    expect(r.status).toBe("FAILED");
    expect(r.proximaTentativa).toBeNull();
  });
});

describe("opt-out bloqueia campanha, nunca transacional", () => {
  it("CAMPANHA sem opt-in → bloqueada", () => {
    expect(bloqueadaPorOptOut("CAMPANHA", false)).toBe(true);
  });
  it("CAMPANHA com opt-in → passa", () => {
    expect(bloqueadaPorOptOut("CAMPANHA", true)).toBe(false);
  });
  it("TRANSACIONAL nunca é bloqueada (mesmo sem opt-in)", () => {
    expect(bloqueadaPorOptOut("TRANSACIONAL", false)).toBe(false);
  });
  it('reconhece "SAIR"/"PARAR" e ignora conversa normal', () => {
    for (const t of ["SAIR", "parar", " Pare. ", "cancelar", "STOP"]) {
      expect(isOptOutReply(t)).toBe(true);
    }
    expect(isOptOutReply("quero agendar amanhã")).toBe(false);
  });
});
