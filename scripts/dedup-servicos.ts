/**
 * A6 — limpeza dos serviços duplicados que já estão em produção.
 *
 * O cadastro não checava nome (só o `code` era unificado com sufixo -2, -3) e o
 * botão não travava no clique. Resultado conhecido: três registros
 * "Buço · 10min". Agora a trava existe (`adminCreateService`), mas os
 * duplicados antigos continuam lá.
 *
 * O que faz, por grupo de nome+categoria equivalente (sem acento, sem caixa):
 *   1. Elege o SOBREVIVENTE: o que tem mais histórico; empate, o mais antigo.
 *      Mais histórico ganha porque re-apontar é o que tem risco — quanto menos
 *      linhas mexer, melhor.
 *   2. Re-aponta bookings, booking_items, event_sessions e waitlist dos outros
 *      para ele.
 *   3. ARQUIVA os demais (archived_at). Nunca apaga: se algo der errado, a
 *      linha ainda está lá para conferência.
 *
 * Idempotente: rodar de novo não encontra mais grupos e não faz nada.
 *
 * Uso (DRY-RUN por padrão — não escreve nada):
 *   DATABASE_URL="..." npx tsx scripts/dedup-servicos.ts
 * Para aplicar de verdade:
 *   DATABASE_URL="..." npx tsx scripts/dedup-servicos.ts --aplicar
 */
import { PrismaClient } from "@prisma/client";
import { chaveServico } from "../src/lib/servico-nome";

const prisma = new PrismaClient();
const APLICAR = process.argv.includes("--aplicar");

async function main() {
  const servicos = await prisma.service.findMany({
    where: { archivedAt: null },
    include: {
      _count: {
        select: {
          bookings: true,
          bookingItems: true,
          eventSessions: true,
          waitlist: true,
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  const grupos = new Map<string, typeof servicos>();
  for (const s of servicos) {
    const k = `${s.category}::${chaveServico(s.name)}`;
    const atual = grupos.get(k);
    if (atual) atual.push(s);
    else grupos.set(k, [s]);
  }

  const duplicados = Array.from(grupos.entries()).filter(
    ([, lista]) => lista.length > 1,
  );

  console.log(
    `\n${servicos.length} serviços ativos · ${duplicados.length} grupo(s) duplicado(s)`,
  );
  console.log(
    APLICAR
      ? "MODO: aplicar (vai escrever no banco)\n"
      : "MODO: dry-run (nada será escrito — use --aplicar)\n",
  );

  if (!duplicados.length) {
    console.log("Nada a fazer.\n");
    return;
  }

  let reapontados = 0;
  let arquivados = 0;

  for (const [chave, lista] of duplicados) {
    const peso = (s: (typeof lista)[number]) =>
      s._count.bookings +
      s._count.bookingItems +
      s._count.eventSessions +
      s._count.waitlist;

    const ordenado = [...lista].sort(
      (a, b) => peso(b) - peso(a) || a.createdAt.getTime() - b.createdAt.getTime(),
    );
    const sobrevivente = ordenado[0];
    const perdedores = ordenado.slice(1);
    // O grupo veio de um filtro `lista.length > 1`, então sempre há um [0] —
    // o guarda é só para o TS estrito não precisar de `!`.
    if (!sobrevivente) continue;

    console.log(`— ${chave}`);
    console.log(
      `  MANTÉM  ${sobrevivente.code} (${sobrevivente.id}) · ${peso(sobrevivente)} referência(s)`,
    );

    for (const p of perdedores) {
      console.log(
        `  move    ${p.code} (${p.id}) · ${peso(p)} referência(s) → arquiva`,
      );
      if (!APLICAR) continue;

      await prisma.$transaction(async (tx) => {
        const b = await tx.booking.updateMany({
          where: { serviceId: p.id },
          data: { serviceId: sobrevivente.id },
        });
        const bi = await tx.bookingItem.updateMany({
          where: { serviceId: p.id },
          data: { serviceId: sobrevivente.id },
        });
        const es = await tx.eventSession.updateMany({
          where: { serviceId: p.id },
          data: { serviceId: sobrevivente.id },
        });
        const w = await tx.waitlist.updateMany({
          where: { serviceId: p.id },
          data: { serviceId: sobrevivente.id },
        });
        // service_availability tem onDelete: Cascade e é config do serviço
        // perdedor — não faz sentido migrar, o sobrevivente tem a própria.
        await tx.service.update({
          where: { id: p.id },
          data: { archivedAt: new Date(), active: false },
        });
        reapontados += b.count + bi.count + es.count + w.count;
        arquivados++;
      });
    }
  }

  console.log(
    APLICAR
      ? `\nPronto: ${reapontados} referência(s) re-apontada(s), ${arquivados} serviço(s) arquivado(s).\n`
      : `\nDry-run: nada foi escrito. Rode com --aplicar para valer.\n`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
