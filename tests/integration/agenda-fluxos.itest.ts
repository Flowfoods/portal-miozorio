import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { PrismaClient } from "@prisma/client";
import { limparBookings, zerarAgenda } from "./_helpers";
import { reativarBooking, validarTamanho } from "@/lib/booking-service";

/**
 * Fluxos da frente de agendamento contra o banco de verdade.
 *
 * Cobre o que estava listado como "exige banco e ficou fora" no relatório da
 * Fase 3: a reativação disputando um horário ocupado e o ajuste de tamanho que
 * estende a duração e colide com o próximo atendimento. Nos dois casos a
 * garantia é a constraint, não o código — um mock não provaria nada.
 */

const prisma = new PrismaClient();

let professionalId: string;
let serviceId: string;
let customerId: string;
let varianteCurtoId: string;
let varianteLongoId: string;

/**
 * Um horário SEMPRE no futuro. Data fixa aqui vira bomba-relógio: a primeira
 * versão deste arquivo usou 13/06/2026 e, rodando em setembro, `reativarBooking`
 * recusou tudo com `no_past` — o teste falhava por causa do calendário, não do
 * código. +30 dias, arredondado para uma hora cheia.
 */
const SAB_14H = (() => {
  const d = new Date(Date.now() + 30 * 24 * 60 * 60_000);
  d.setUTCHours(17, 0, 0, 0);
  return d;
})();
const fim = (inicio: Date, min: number) =>
  new Date(inicio.getTime() + min * 60_000);

beforeAll(async () => {
  // A suíte é dona do banco: começa de uma agenda vazia.
  await zerarAgenda(prisma);
  const prof = await prisma.professional.create({
    data: { name: "Milene (fluxos)" },
  });
  professionalId = prof.id;

  const svc = await prisma.service.create({
    data: {
      code: `teste-fluxos-${Date.now()}`,
      name: "Escova de teste",
      category: "cabelo",
      durationMin: 45,
      bufferMin: 15,
      priceCents: 8000,
      variants: {
        create: [
          { nome: "curto", priceCents: 6000, sort: 0 },
          // Longo ocupa 3h: o suficiente para bater no atendimento seguinte.
          { nome: "longo", priceCents: 12000, durationMin: 180, sort: 1 },
        ],
      },
    },
    include: { variants: { orderBy: { sort: "asc" } } },
  });
  serviceId = svc.id;
  varianteCurtoId = svc.variants[0]!.id;
  varianteLongoId = svc.variants[1]!.id;

  const cli = await prisma.customer.create({
    data: { name: "Cliente Fluxos", phoneE164: `+552198${Date.now() % 1000000}` },
  });
  customerId = cli.id;
});

beforeEach(async () => {
  await limparBookings(prisma, professionalId);
});

afterAll(async () => {
  await limparBookings(prisma, professionalId);
  await prisma.$disconnect();
});

async function criar(
  startsAt: Date,
  endsAt: Date,
  status: "pending" | "confirmed" | "cancelled_by_business",
  extra: Record<string, unknown> = {},
) {
  return prisma.booking.create({
    data: {
      customerId,
      serviceId,
      professionalId,
      startsAt,
      endsAt,
      status,
      priceCents: 8000,
      ...extra,
    },
  });
}

describe("A5 — reativar disputa o horário de verdade", () => {
  it("reativa quando o horário continua livre", async () => {
    const b = await criar(SAB_14H, fim(SAB_14H, 60), "cancelled_by_business", {
      cancelledBy: "SYSTEM",
    });
    const r = await reativarBooking(b.id);
    expect(r.ok).toBe(true);

    const depois = await prisma.booking.findUniqueOrThrow({
      where: { id: b.id },
    });
    expect(depois.status).toBe("confirmed");
    // A marca de quem cancelou some: não é mais um cancelamento.
    expect(depois.cancelledBy).toBeNull();
  });

  it("RECUSA quando outra cliente já pegou o horário", async () => {
    const cancelado = await criar(
      SAB_14H,
      fim(SAB_14H, 60),
      "cancelled_by_business",
      { cancelledBy: "SYSTEM" },
    );
    await criar(SAB_14H, fim(SAB_14H, 60), "confirmed"); // alguém ocupou

    const r = await reativarBooking(cancelado.id);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("slot_taken");

    // E o agendamento NÃO virou confirmado pela metade.
    const depois = await prisma.booking.findUniqueOrThrow({
      where: { id: cancelado.id },
    });
    expect(depois.status).toBe("cancelled_by_business");
  });

  it("recusa horário que já passou — encaixe novo é outro caminho", async () => {
    const passado = new Date("2020-01-04T17:00:00.000Z"); // bem no passado
    const b = await criar(
      passado,
      fim(passado, 60),
      "cancelled_by_business",
      { cancelledBy: "SYSTEM" },
    );
    const r = await reativarBooking(b.id);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("no_past");
  });

  it("recusa reativar o que já está confirmado", async () => {
    const b = await criar(SAB_14H, fim(SAB_14H, 60), "confirmed");
    const r = await reativarBooking(b.id);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("not_reactivatable");
  });
});

describe("A3 — ajuste de tamanho mexe no bloco da agenda", () => {
  it("aprovar o tamanho escolhido grava a validação e o preço", async () => {
    const b = await criar(SAB_14H, fim(SAB_14H, 60), "pending", {
      variantId: varianteCurtoId,
      priceCents: 6000,
    });
    const r = await validarTamanho(b.id, null);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.priceCents).toBe(6000);

    const depois = await prisma.booking.findUniqueOrThrow({
      where: { id: b.id },
    });
    expect(depois.sizeApprovedAt).not.toBeNull();
    // Aprovar o que a cliente escolheu não é "ajuste": sem motivo registrado.
    expect(depois.sizeAdjustReason).toBeNull();
  });

  it("ajustar para um tamanho maior recalcula preço E duração", async () => {
    const b = await criar(SAB_14H, fim(SAB_14H, 60), "pending", {
      variantId: varianteCurtoId,
      priceCents: 6000,
    });
    const r = await validarTamanho(b.id, varianteLongoId, "cabelo bem longo");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.priceCents).toBe(12000);

    const depois = await prisma.booking.findUniqueOrThrow({
      where: { id: b.id },
    });
    // 180 min da variação + 15 de buffer = 195.
    const duracaoMin =
      (depois.endsAt.getTime() - depois.startsAt.getTime()) / 60_000;
    expect(duracaoMin).toBe(195);
    expect(depois.sizeAdjustReason).toBe("cabelo bem longo");
  });

  it("RECUSA o ajuste que faria o bloco maior bater no próximo atendimento", async () => {
    // Este é o caso que só o banco pega: o ajuste é uma escrita que passa pela
    // constraint. Sem ela, a agenda ficaria com dois atendimentos sobrepostos.
    const b = await criar(SAB_14H, fim(SAB_14H, 60), "pending", {
      variantId: varianteCurtoId,
      priceCents: 6000,
    });
    // Próxima cliente 1h depois — o tamanho "longo" (195 min) invade.
    const logoDepois = new Date(SAB_14H.getTime() + 60 * 60_000);
    await criar(logoDepois, fim(logoDepois, 60), "confirmed");

    const r = await validarTamanho(b.id, varianteLongoId);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.code).toBe("slot_taken");
      expect(r.message.toLowerCase()).toContain("remarque");
    }

    // O agendamento fica intacto: nem preço nem duração mudaram pela metade.
    const depois = await prisma.booking.findUniqueOrThrow({
      where: { id: b.id },
    });
    expect(depois.priceCents).toBe(6000);
    expect(depois.variantId).toBe(varianteCurtoId);
    expect(depois.sizeApprovedAt).toBeNull();
  });

  it("recusa tamanho que não pertence ao serviço", async () => {
    const b = await criar(SAB_14H, fim(SAB_14H, 60), "pending", {
      variantId: varianteCurtoId,
      priceCents: 6000,
    });
    const r = await validarTamanho(b.id, "00000000-0000-0000-0000-000000000000");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("variante_invalida");
  });

  it("recusa validar tamanho em agendamento que não tem variação", async () => {
    const b = await criar(SAB_14H, fim(SAB_14H, 60), "pending");
    const r = await validarTamanho(b.id, null);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("sem_variacao");
  });
});

describe("A1 — arquivar preserva o histórico", () => {
  it("serviço arquivado some da listagem e os atendimentos continuam lá", async () => {
    const svc = await prisma.service.create({
      data: {
        code: `teste-arquivo-${Date.now()}`,
        name: "Serviço a arquivar",
        category: "social",
        durationMin: 30,
        priceCents: 5000,
      },
    });
    const b = await prisma.booking.create({
      data: {
        customerId,
        serviceId: svc.id,
        professionalId,
        startsAt: SAB_14H,
        endsAt: fim(SAB_14H, 45),
        status: "completed",
        priceCents: 5000,
      },
    });

    await prisma.service.update({
      where: { id: svc.id },
      data: { archivedAt: new Date(), active: false },
    });

    // Some das listagens (é o filtro que o admin, o /agendar e o /dia-a-dia usam).
    const visiveis = await prisma.service.findMany({
      where: { archivedAt: null, id: svc.id },
    });
    expect(visiveis).toHaveLength(0);

    // Mas o atendimento continua consultável, com o nome do serviço.
    const historico = await prisma.booking.findUniqueOrThrow({
      where: { id: b.id },
      include: { service: true },
    });
    expect(historico.service.name).toBe("Serviço a arquivar");

    await prisma.booking.delete({ where: { id: b.id } });
    await prisma.service.delete({ where: { id: svc.id } });
  });
});
