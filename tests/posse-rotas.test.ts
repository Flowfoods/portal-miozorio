import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * As três rotas públicas de uma reserva, chamadas DE VERDADE — não a guarda
 * isolada. `posse-sinal.test.ts` prova que a guarda decide certo e que cada
 * handler a menciona; este arquivo prova o que só a rota inteira mostra: a
 * ORDEM. Sem gateway o `/sinal` responde 501 antes de olhar posse; com posse
 * negada, o 403 sai sem que a resposta dependa de a reserva existir — sem
 * sessão ou com a provisória, sem consulta nenhuma; logada de outra conta, uma
 * consulta, e o 403 é o mesmo com ou sem reserva.
 *
 * É a ordem que segura a promessa "403 não depende de a reserva existir".
 * Trocar duas linhas de lugar não muda nenhum status isolado e derruba a
 * promessa inteira — por isso ela tem teste próprio, e por isso aqui contamos
 * consultas ao banco em vez de só olhar o status.
 */

const H = vi.hoisted(() => ({
  cookies: new Map<string, string>(),
  sessao: null as { customerId: string; prov: boolean; tv: number } | null,
  sessaoLanca: false,
  reservas: new Map<string, Record<string, unknown>>(),
  consultas: 0,
  prismaLanca: false,
  gateway: null as null | {
    nome: string;
    criarCobrancaPix: (i: unknown) => Promise<{
      id: string;
      copiaECola: string;
      qrCodeBase64: string | null;
      expiraEm: Date | null;
    }>;
  },
  cobrancas: [] as unknown[],
  confirmadas: [] as string[],
}));

vi.mock("next/headers", () => ({
  cookies: () => ({
    get: (n: string) =>
      H.cookies.has(n) ? { name: n, value: H.cookies.get(n)! } : undefined,
  }),
}));

vi.mock("@/lib/cliente-auth", () => ({
  getClienteSession: async () => {
    if (H.sessaoLanca) throw new Error("NEXTAUTH_SECRET ausente");
    return H.sessao;
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    booking: {
      findUnique: async ({ where }: { where: { id: string } }) => {
        H.consultas++;
        // O Prisma real recusa `where.id` que não é UUID — a guarda tem um
        // `.catch(() => null)` para isso e o teste "id não-UUID" o exercita.
        if (H.prismaLanca) throw new Error("Prisma: invalid uuid");
        return H.reservas.get(where.id) ?? null;
      },
      update: async ({
        where,
        data,
      }: {
        where: { id: string };
        data: Record<string, unknown>;
      }) => {
        const r = H.reservas.get(where.id);
        if (!r) throw new Error("reserva não encontrada");
        Object.assign(r, data);
        return r;
      },
    },
  },
}));

vi.mock("@/lib/pagamento", () => ({
  gatewayAtivo: () => H.gateway,
}));

vi.mock("@/lib/settings", () => ({
  getSettings: async () => ({ depositHoldHours: 24 }),
}));

vi.mock("@/lib/booking-service", () => ({
  confirmBooking: async (id: string) => {
    H.confirmadas.push(id);
    return { ok: true, status: "confirmed" };
  },
  getBookingStatus: async (id: string) => {
    H.consultas++;
    const r = H.reservas.get(id);
    return r ? { id, status: r.status } : null;
  },
}));

import { POST as confirmar } from "@/app/api/bookings/[id]/confirm/route";
import {
  POST as gerarSinal,
  GET as lerSinal,
} from "@/app/api/bookings/[id]/sinal/route";
import { GET as lerReserva } from "@/app/api/bookings/[id]/route";
import { assinarPosse, nomeCookiePosse } from "@/lib/posse-reserva";
import { temPosseDaReserva } from "@/lib/posse-reserva-guarda";

const RESERVA = "6a1f3c2e-0b5d-4e77-9a11-2b3c4d5e6f70";
const DONA = "aaaa1111-2222-3333-4444-555566667777";
const ESTRANHA = "bbbb1111-2222-3333-4444-555566667777";
const CTX = { params: { id: RESERVA } };

const req = (method: "GET" | "POST") =>
  new Request(`http://localhost/api/bookings/${RESERVA}`, { method });

function comComprovante(id = RESERVA): void {
  H.cookies.set(
    nomeCookiePosse(id),
    assinarPosse(id, new Date(Date.now() + 8 * 60_000)),
  );
}

function comGateway(): void {
  H.gateway = {
    nome: "mercadopago",
    criarCobrancaPix: async (i) => {
      H.cobrancas.push(i);
      return {
        id: "pay_1",
        copiaECola: "00020126580014br.gov.bcb.pix",
        qrCodeBase64: null,
        expiraEm: null,
      };
    },
  };
}

beforeEach(() => {
  process.env.NEXTAUTH_SECRET = "segredo-de-teste-para-o-hmac-do-cookie";
  H.cookies.clear();
  H.sessao = null;
  H.sessaoLanca = false;
  H.reservas.clear();
  H.consultas = 0;
  H.prismaLanca = false;
  H.gateway = null;
  H.cobrancas = [];
  H.confirmadas = [];
  H.reservas.set(RESERVA, {
    id: RESERVA,
    customerId: DONA,
    status: "pending",
    depositCents: 5000,
    depositPaidAt: null,
    depositPaymentId: null,
    holdExpiresAt: new Date(Date.now() + 8 * 60_000),
    customer: { name: "Cliente", phoneE164: "+5521999990001", email: null },
    service: { name: "Prévia de maquiagem" },
  });
});

describe("POST /sinal — a ordem é gateway → posse → banco", () => {
  it("sem gateway: 501 para quem NÃO é dona, sem olhar posse nem banco", async () => {
    const res = await gerarSinal(req("POST"), CTX);
    expect(res.status).toBe(501);
    expect((await res.json()).code).toBe("sem_gateway");
    // Se a posse viesse antes, a estranha tomaria 403 — e um portal sem PIX
    // passaria a contar quem é dona de quê.
    expect(H.consultas).toBe(0);
  });

  it("sem gateway: a MESMA resposta para a dona", async () => {
    comComprovante();
    const res = await gerarSinal(req("POST"), CTX);
    expect(res.status).toBe(501);
    expect((await res.json()).code).toBe("sem_gateway");
  });

  it("com gateway, estranha: 403 sem_posse ANTES de qualquer consulta", async () => {
    comGateway();
    const res = await gerarSinal(req("POST"), CTX);
    expect(res.status).toBe(403);
    expect((await res.json()).code).toBe("sem_posse");
    expect(H.consultas).toBe(0);
    expect(H.cobrancas).toHaveLength(0);
  });

  it("com gateway, a dona gera a cobrança", async () => {
    comGateway();
    comComprovante();
    const res = await gerarSinal(req("POST"), CTX);
    expect(res.status).toBe(200);
    const d = await res.json();
    expect(d.copiaECola).toContain("br.gov.bcb.pix");
    expect(d.valorCents).toBe(5000);
    expect(H.cobrancas).toHaveLength(1);
    expect(H.reservas.get(RESERVA)?.depositPaymentId).toBe("pay_1");
  });

  it("a mensagem do 403 não repete o convite ao WhatsApp — a tela já o emenda", async () => {
    comGateway();
    const d = await (await gerarSinal(req("POST"), CTX)).json();
    expect(d.error).not.toMatch(/WhatsApp/);
  });
});

describe("GET /sinal — o lado da rota que nunca dormiu", () => {
  it("estranha: 403 sem consulta, mesmo sem gateway", async () => {
    const res = await lerSinal(req("GET"), CTX);
    expect(res.status).toBe(403);
    expect((await res.json()).code).toBe("sem_posse");
    expect(H.consultas).toBe(0);
  });

  it("dona: 200 com o estado do sinal", async () => {
    comComprovante();
    const res = await lerSinal(req("GET"), CTX);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ pago: false, confirmado: false });
  });
});

describe("GET /api/bookings/[id]", () => {
  it("estranha: 403 sem consulta", async () => {
    const res = await lerReserva(req("GET"), CTX);
    expect(res.status).toBe(403);
    expect(H.consultas).toBe(0);
  });

  it("dona: 200 com o status", async () => {
    comComprovante();
    const res = await lerReserva(req("GET"), CTX);
    expect(res.status).toBe(200);
    expect((await res.json()).status).toBe("pending");
  });
});

describe("POST /confirm — continua igual depois da extração da guarda", () => {
  it("estranha: 403 e confirmBooking nem é chamado", async () => {
    const res = await confirmar(req("POST"), CTX);
    expect(res.status).toBe(403);
    expect((await res.json()).code).toBe("sem_posse");
    expect(H.confirmadas).toHaveLength(0);
  });

  it("dona: confirma e o comprovante é limpo do navegador", async () => {
    comComprovante();
    const res = await confirmar(req("POST"), CTX);
    expect(res.status).toBe(200);
    expect(H.confirmadas).toEqual([RESERVA]);
    const apagado = res.cookies.get(nomeCookiePosse(RESERVA));
    expect(apagado?.value).toBe("");
    expect(apagado?.maxAge).toBe(0);
  });
});

describe("guarda — quando a 2ª porta NÃO pode ir ao banco", () => {
  it("sem sessão: nenhuma consulta", async () => {
    await expect(temPosseDaReserva(RESERVA)).resolves.toBe(false);
    expect(H.consultas).toBe(0);
  });

  it("sessão provisória: recusada ANTES de consultar", async () => {
    // A versão anterior da guarda consultava o banco e só então recusava a
    // provisória — resultado igual, I/O diferente, e a promessa "403 antes de
    // qualquer consulta" valia só para o caminho anônimo.
    H.sessao = { customerId: DONA, prov: true, tv: 1 };
    await expect(temPosseDaReserva(RESERVA)).resolves.toBe(false);
    expect(H.consultas).toBe(0);
  });

  it("sessão de verdade: UMA consulta, e só então decide", async () => {
    H.sessao = { customerId: DONA, prov: false, tv: 1 };
    await expect(temPosseDaReserva(RESERVA)).resolves.toBe(true);
    expect(H.consultas).toBe(1);
  });

  it("estranha LOGADA: uma consulta, e o 403 é o mesmo com ou sem reserva", async () => {
    // O único caminho de posse negada que chega ao banco. O que a ordem
    // promete aqui não é "zero consultas" — é que a resposta não conta se a
    // reserva existe. Por isso o teste compara os dois casos.
    H.sessao = { customerId: ESTRANHA, prov: false, tv: 1 };
    const comReserva = await lerReserva(req("GET"), CTX);
    expect(comReserva.status).toBe(403);
    expect(H.consultas).toBe(1);

    H.reservas.clear();
    H.consultas = 0;
    const semReserva = await lerReserva(req("GET"), CTX);
    expect(semReserva.status).toBe(403);
    expect(await semReserva.json()).toEqual(await comReserva.json());
  });

  it("id que não é UUID: o Prisma lança, a guarda devolve não", async () => {
    H.sessao = { customerId: DONA, prov: false, tv: 1 };
    H.prismaLanca = true;
    await expect(temPosseDaReserva("nao-e-uuid")).resolves.toBe(false);
  });

  it("segredo ausente COM cookie do Clube: 403, não 500", async () => {
    // `getClienteSession` lança nesse estado. Antes deste try, as três rotas
    // responderiam 500 para qualquer pessoa com cookie do Clube no navegador.
    const erro = vi.spyOn(console, "error").mockImplementation(() => {});
    H.sessaoLanca = true;
    const res = await lerReserva(req("GET"), CTX);
    expect(res.status).toBe(403);
    expect(erro).toHaveBeenCalled();
    erro.mockRestore();
  });
});
