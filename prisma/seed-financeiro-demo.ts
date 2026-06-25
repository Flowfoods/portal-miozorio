/**
 * Dados de EXEMPLO do Financeiro (Fase 6) — para ver o dashboard populado.
 * NÃO roda no boot. Use num banco de dev/staging:
 *   npx tsx prisma/seed-financeiro-demo.ts
 * Idempotente: pula se já houver lançamentos "DEMO". Inclui 3 meses, uma noiva
 * parcelada (sinal + 2 parcelas em meses diferentes) e um mês no prejuízo.
 */
import { PrismaClient } from "@prisma/client";
import { DateTime } from "luxon";

const prisma = new PrismaClient();

const BRL = (reais: number) => Math.round(reais * 100);
const compDate = (dt: DateTime) =>
  DateTime.fromObject({ year: dt.year, month: dt.month, day: 15 }, { zone: "utc" }).toJSDate();

async function catId(code: string): Promise<string | null> {
  const c = await prisma.financialCategory.findUnique({ where: { code }, select: { id: true } });
  return c?.id ?? null;
}

async function main() {
  const jaTem = await prisma.revenueEntry.findFirst({ where: { description: { startsWith: "DEMO" } } });
  if (jaTem) {
    console.log("demo: já existe — pulado");
    return;
  }

  const now = DateTime.now();
  const m0 = now; // mês atual (normal, com lucro)
  const m1 = now.minus({ months: 1 }); // mês anterior
  const m2 = now.minus({ months: 2 }); // prejuízo

  const [revSocial, revNoiva, expAluguel, expInsumos, expProlabore, expTaxa] =
    await Promise.all([
      catId("rev-social"),
      catId("rev-noiva"),
      catId("exp-aluguel"),
      catId("exp-insumos"),
      catId("exp-prolabore"),
      catId("exp-taxa-cartao"),
    ]);

  // Receitas
  await prisma.revenueEntry.createMany({
    data: [
      // Mês atual — social
      { categoryId: revSocial, description: "DEMO Maquiagem social", amountCents: BRL(250), competenceDate: compDate(m0), receivedAt: compDate(m0), source: "manual", paymentMethod: "pix" },
      { categoryId: revSocial, description: "DEMO Penteado", amountCents: BRL(350), competenceDate: compDate(m0), receivedAt: compDate(m0), source: "manual", paymentMethod: "cartao", cardFeeCents: BRL(10.5) },
      // Noiva parcelada: sinal (m2) + parcelas (m1, m0)
      { categoryId: revNoiva, description: "DEMO Noiva — sinal", amountCents: BRL(300), competenceDate: compDate(m2), receivedAt: compDate(m2), source: "manual", customerName: "Noiva Demo", paymentMethod: "pix" },
      { categoryId: revNoiva, description: "DEMO Noiva — parcela 1/2", amountCents: BRL(1493.5), competenceDate: compDate(m1), receivedAt: compDate(m1), source: "manual", customerName: "Noiva Demo", paymentMethod: "cartao", cardFeeCents: BRL(45) },
      { categoryId: revNoiva, description: "DEMO Noiva — parcela 2/2", amountCents: BRL(1493.5), competenceDate: compDate(m0), receivedAt: compDate(m0), source: "manual", customerName: "Noiva Demo", paymentMethod: "cartao", cardFeeCents: BRL(45) },
    ],
  });

  // Despesas
  await prisma.expense.createMany({
    data: [
      // Fixos nos 3 meses
      ...[m0, m1, m2].map((m) => ({ categoryId: expAluguel!, description: "DEMO Aluguel do estúdio", amountCents: BRL(900), competenceDate: compDate(m), paidAt: compDate(m), paymentMethod: "pix" })),
      ...[m0, m1, m2].map((m) => ({ categoryId: expProlabore!, description: "DEMO Pró-labore", amountCents: BRL(1500), competenceDate: compDate(m), paidAt: compDate(m), paymentMethod: "pix" })),
      // Variáveis
      { categoryId: expInsumos!, description: "DEMO Insumos", amountCents: BRL(180), competenceDate: compDate(m0), paidAt: compDate(m0), paymentMethod: "cartao" },
      { categoryId: expInsumos!, description: "DEMO Insumos", amountCents: BRL(120), competenceDate: compDate(m1), paidAt: compDate(m1), paymentMethod: "cartao" },
      // Mês -2 = prejuízo: só o sinal de receita, fixos cheios
      { categoryId: expTaxa!, description: "DEMO Taxa maquininha", amountCents: BRL(20), competenceDate: compDate(m2), paidAt: compDate(m2), paymentMethod: "cartao" },
    ].filter((e) => e.categoryId),
  });

  console.log("✓ demo financeiro: 3 meses (noiva parcelada + mês no prejuízo)");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
