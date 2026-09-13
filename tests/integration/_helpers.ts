import type { PrismaClient } from "@prisma/client";

/**
 * Apaga os agendamentos de uma profissional de teste, na ordem certa.
 *
 * `booking_events` NÃO tem ON DELETE CASCADE — é auditoria, e apagar em
 * cascata seria justamente o que não se quer em produção. Nos testes isso
 * significa limpar os filhos primeiro, senão o `deleteMany` morre com
 * `booking_events_booking_id_fkey` assim que algum teste exercita uma
 * transição de status (que é o ponto destes testes).
 */
export async function limparBookings(
  prisma: PrismaClient,
  professionalId: string,
): Promise<void> {
  const ids = (
    await prisma.booking.findMany({
      where: { professionalId },
      select: { id: true },
    })
  ).map((b) => b.id);
  if (!ids.length) return;

  await prisma.bookingEvent.deleteMany({ where: { bookingId: { in: ids } } });
  await prisma.notificationLog.deleteMany({ where: { bookingId: { in: ids } } });
  await prisma.revenueEntry.deleteMany({ where: { bookingId: { in: ids } } });
  await prisma.testimonial.deleteMany({ where: { bookingId: { in: ids } } });
  // booking_items tem cascade; o resto foi limpo acima.
  await prisma.booking.deleteMany({ where: { id: { in: ids } } });
}

/**
 * Zera TODOS os agendamentos do banco de teste.
 *
 * Necessário porque `findOverlappingBooking` (em booking-service) procura
 * colisão por HORÁRIO, sem filtrar profissional — é o comportamento correto
 * para um estúdio de uma pessoa só, mas significa que um agendamento deixado
 * por uma execução anterior ocupa o horário desta. Sem isto a suíte passa num
 * banco novo e falha ao rodar duas vezes seguidas, que é o pior tipo de teste.
 *
 * O banco de integração é descartável e a suíte é dona dele.
 */
export async function zerarAgenda(prisma: PrismaClient): Promise<void> {
  await prisma.bookingEvent.deleteMany({});
  await prisma.notificationLog.deleteMany({});
  await prisma.revenueEntry.deleteMany({});
  await prisma.testimonial.deleteMany({});
  await prisma.booking.deleteMany({});
}
