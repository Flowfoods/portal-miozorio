import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { PrismaClient } from "@prisma/client";
import { limparBookings, zerarAgenda } from "./_helpers";

/**
 * R2 — a trava anti-double-booking, testada contra o banco de verdade.
 *
 * Esta é a regra mais crítica do sistema e até aqui tinha ZERO cobertura
 * automatizada: ela não mora no código, mora numa constraint
 * (`EXCLUDE USING gist`), e mockar o Prisma testaria o mock. Um teste que não
 * fala com o Postgres não diz nada sobre ela.
 *
 * Também trava por baixo a decisão do R21: a constraint é PARCIAL
 * (`WHERE status IN ('pending','confirmed')`), então um status novo cairia fora
 * dela. O último teste deste arquivo prova isso — é a evidência de por que
 * "aguardando validação de tamanho" virou flag e não status.
 */

const prisma = new PrismaClient();

/** 23P01 = exclusion_violation. É assim que o banco recusa a sobreposição. */
function ehExclusionViolation(e: unknown): boolean {
  const msg = String((e as { message?: string })?.message ?? e);
  return msg.includes("23P01") || msg.includes("no_overlap");
}

let professionalId: string;
let serviceId: string;
let customerId: string;

const SAB_14H = new Date("2026-06-13T17:00:00.000Z"); // 14:00 BRT
const fim = (inicio: Date, min: number) =>
  new Date(inicio.getTime() + min * 60_000);

async function criar(
  startsAt: Date,
  endsAt: Date,
  status: "pending" | "confirmed" | "cancelled_by_business" | "completed",
) {
  return prisma.booking.create({
    data: {
      customerId,
      serviceId,
      professionalId,
      startsAt,
      endsAt,
      status,
      priceCents: 10000,
    },
    select: { id: true },
  });
}

beforeAll(async () => {
  // A suíte é dona do banco: começa de uma agenda vazia.
  await zerarAgenda(prisma);
  const prof = await prisma.professional.create({
    data: { name: "Milene (teste)" },
  });
  professionalId = prof.id;
  const svc = await prisma.service.create({
    data: {
      code: `teste-overlap-${Date.now()}`,
      name: "Serviço de teste",
      category: "social",
      durationMin: 60,
      bufferMin: 15,
      priceCents: 10000,
    },
  });
  serviceId = svc.id;
  const cli = await prisma.customer.create({
    data: { name: "Cliente Teste", phoneE164: `+552199${Date.now() % 1000000}` },
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

describe("R2 — o banco recusa sobreposição", () => {
  it("dois agendamentos confirmados no MESMO horário: o segundo é recusado", async () => {
    await criar(SAB_14H, fim(SAB_14H, 75), "confirmed");
    await expect(
      criar(SAB_14H, fim(SAB_14H, 75), "confirmed"),
    ).rejects.toSatisfy(ehExclusionViolation);
  });

  it("sobreposição PARCIAL também é recusada", async () => {
    // 14:00–15:15 e 15:00–16:15 se cruzam por 15 minutos.
    await criar(SAB_14H, fim(SAB_14H, 75), "confirmed");
    const maisTarde = new Date(SAB_14H.getTime() + 60 * 60_000);
    await expect(
      criar(maisTarde, fim(maisTarde, 75), "confirmed"),
    ).rejects.toSatisfy(ehExclusionViolation);
  });

  it("uma reserva PENDING também segura o horário", async () => {
    // Se pending não travasse, o portal ofereceria o horário que já está
    // reservado e recusaria quem tentasse pegá-lo.
    await criar(SAB_14H, fim(SAB_14H, 75), "pending");
    await expect(
      criar(SAB_14H, fim(SAB_14H, 75), "confirmed"),
    ).rejects.toSatisfy(ehExclusionViolation);
  });

  it("encostar sem cruzar é permitido — o buffer já está no ends_at", async () => {
    const primeiro = await criar(SAB_14H, fim(SAB_14H, 75), "confirmed");
    const emSeguida = fim(SAB_14H, 75);
    const segundo = await criar(emSeguida, fim(emSeguida, 75), "confirmed");
    expect(primeiro.id).not.toBe(segundo.id);
  });
});

describe("R2 — status encerrado libera o horário", () => {
  it("cancelado não bloqueia: o horário volta para a agenda", async () => {
    await criar(SAB_14H, fim(SAB_14H, 75), "cancelled_by_business");
    const novo = await criar(SAB_14H, fim(SAB_14H, 75), "confirmed");
    expect(novo.id).toBeTruthy();
  });

  it("concluído não bloqueia um horário futuro igual", async () => {
    await criar(SAB_14H, fim(SAB_14H, 75), "completed");
    const novo = await criar(SAB_14H, fim(SAB_14H, 75), "confirmed");
    expect(novo.id).toBeTruthy();
  });
});

describe("R21 — por que 'aguardando tamanho' NÃO virou um status", () => {
  it("a constraint é PARCIAL: só cobre pending e confirmed", async () => {
    // Esta é a evidência da decisão de projeto do A3. Se um BookingStatus novo
    // fosse criado para "aguardando validação de tamanho", ele cairia fora
    // deste recorte e o horário deixaria de ser protegido — em silêncio.
    const def = await prisma.$queryRaw<{ d: string }[]>`
      SELECT pg_get_constraintdef(oid) AS d
      FROM pg_constraint WHERE conname = 'no_overlap'
    `;
    const definicao = def[0]?.d ?? "";
    expect(definicao).toContain("EXCLUDE");
    expect(definicao).toContain("pending");
    expect(definicao).toContain("confirmed");
    // Nenhum outro status está no WHERE — é o que torna a adição perigosa.
    expect(definicao).not.toContain("no_show");
    expect(definicao).not.toContain("completed");
  });

  it("prova prática: um status fora do recorte NÃO é protegido", async () => {
    // `completed` está fora do WHERE — dois completed no mesmo horário passam.
    // Um status novo se comportaria exatamente assim.
    await criar(SAB_14H, fim(SAB_14H, 75), "completed");
    const duplicado = await criar(SAB_14H, fim(SAB_14H, 75), "completed");
    expect(duplicado.id).toBeTruthy();
  });
});
