import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Fase 3 — travas que não podem quebrar nunca, testadas com o prisma mockado
 * (mesmo padrão de tests/whatsapp.test.ts).
 */

type ServicoMock = {
  id: string;
  active: boolean;
  archivedAt: Date | null;
  bookableOnline: boolean;
  variants: unknown[];
  priceCents: number;
  priceHomeCents: number | null;
  durationMin: number;
  bufferMin: number;
  requiresDeposit: boolean;
};

const servicos = new Map<string, ServicoMock>();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    service: {
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) =>
        servicos.get(where.id) ?? null,
      ),
    },
    booking: { count: vi.fn(async () => 0) },
    customer: { upsert: vi.fn() },
    professional: { findFirst: vi.fn(async () => ({ id: "prof" })) },
  },
}));

vi.mock("@/lib/settings", () => ({
  getSettings: vi.fn(async () => ({
    timezone: "America/Sao_Paulo",
    holdMinutes: 8,
    depositPercent: 20,
    depositHoldHours: 24,
    depositCutoffHours: 2,
  })),
}));

import { createBooking } from "@/lib/booking-service";

const base = {
  date: "2026-06-13",
  time: "14:00",
  location: "studio" as const,
  customer: { name: "Carla", phone: "21999998888" },
  lgpdConsent: true,
};

function servico(over: Partial<ServicoMock>): ServicoMock {
  return {
    id: "s1",
    active: true,
    archivedAt: null,
    bookableOnline: true,
    variants: [],
    priceCents: 3600,
    priceHomeCents: null,
    durationMin: 30,
    bufferMin: 15,
    requiresDeposit: false,
    ...over,
  };
}

beforeEach(() => servicos.clear());

describe("R1 — noiva e debutante NUNCA agendáveis online", () => {
  it("serviço com bookableOnline=false é recusado no backend", async () => {
    // A trava vale para o POST direto, não só para a UI que esconde o botão.
    servicos.set("s1", servico({ bookableOnline: false }));
    const r = await createBooking({ ...base, serviceId: "s1" });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.code).toBe("not_bookable");
      expect(r.message).toContain("WhatsApp");
    }
  });
});

describe("A1 — serviço arquivado sai de circulação", () => {
  it("arquivado não aceita agendamento novo, mesmo por POST forjado", async () => {
    servicos.set("s1", servico({ archivedAt: new Date() }));
    const r = await createBooking({ ...base, serviceId: "s1" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("invalid_service");
  });

  it("desativado também", async () => {
    servicos.set("s1", servico({ active: false }));
    const r = await createBooking({ ...base, serviceId: "s1" });
    expect(r.ok).toBe(false);
  });
});

describe("A3 — tamanho e foto no backend, não só na tela", () => {
  const comVariacao = servico({
    variants: [
      {
        id: "v1",
        nome: "cabelo curto",
        priceCents: 6000,
        priceHomeCents: null,
        durationMin: null,
        active: true,
      },
    ],
  });

  it("serviço com variação recusa agendamento sem tamanho", async () => {
    servicos.set("s1", comVariacao);
    const r = await createBooking({ ...base, serviceId: "s1" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("variante_invalida");
  });

  it("com tamanho mas SEM foto também é recusado", async () => {
    // A foto é o que permite a Mi conferir antes de fechar o valor.
    servicos.set("s1", comVariacao);
    const r = await createBooking({
      ...base,
      serviceId: "s1",
      variantId: "v1",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("foto_obrigatoria");
  });

  it("variação de OUTRO serviço não cola", async () => {
    servicos.set("s1", comVariacao);
    const r = await createBooking({
      ...base,
      serviceId: "s1",
      variantId: "v-de-outro-servico",
      photoKey: "priv/abc.webp",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("variante_invalida");
  });

  it("serviço SEM variação recusa quem tenta mandar uma", async () => {
    servicos.set("s1", servico({}));
    const r = await createBooking({
      ...base,
      serviceId: "s1",
      variantId: "v1",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("variante_invalida");
  });
});

describe("LGPD — consentimento é porta de entrada", () => {
  it("sem aceite, nada é criado", async () => {
    servicos.set("s1", servico({}));
    const r = await createBooking({
      ...base,
      serviceId: "s1",
      lgpdConsent: false,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("no_consent");
  });
});

describe("R6/R18 — alergia é dado de saúde, exige consentimento específico", () => {
  it("POST forjado com alergia e sem autorização é recusado", async () => {
    // A caixinha da tela não é a trava: a rota é pública e qualquer cliente
    // HTTP monta o corpo sem passar pelo formulário. A regra vive no motor.
    servicos.set("s1", servico({}));
    const r = await createBooking({
      ...base,
      serviceId: "s1",
      anamnesis: { alergia: "níquel", ocasiao: "festa" },
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.code).toBe("no_health_consent");
      expect(r.message).toContain("alergia");
    }
  });

  it("aceitar a política genérica NÃO libera o dado sensível", async () => {
    // `lgpdConsent: true` já vem do `base`. É exatamente o buraco que a dívida
    // apontava: um aceite genérico cobrindo dado de saúde.
    servicos.set("s1", servico({}));
    const r = await createBooking({
      ...base,
      serviceId: "s1",
      lgpdConsent: true,
      anamnesis: { alergia: "cheiro forte" },
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("no_health_consent");
  });

  it("a recusa vem ANTES de qualquer consulta ao banco", async () => {
    // Nenhum serviço registrado no mock: se a trava do consentimento rodasse
    // depois do lookup, o código seria "invalid_service". Ela precisa vir antes
    // — dado sensível não deve nem chegar perto de uma query.
    servicos.clear();
    const r = await createBooking({
      ...base,
      serviceId: "inexistente",
      anamnesis: { alergia: "níquel" },
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("no_health_consent");
  });

  // O caso "sem alergia → não exige nada" é coberto em
  // tests/consentimento-saude.test.ts, contra a função pura. Aqui ele só
  // atravessaria o motor inteiro até `getAvailability`, que este arquivo não
  // mocka — testaria a montagem do mock, não a regra.
});
