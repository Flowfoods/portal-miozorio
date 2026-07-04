import { prisma } from "./prisma";
import { MANUTENCAO_DIAS_DEFAULT } from "./jornadas";

/**
 * Retenção (F5): "Hora de se cuidar de novo". Sugere reagendar o último
 * cuidado quando a cliente passou da cadência de manutenção e não tem
 * horário futuro. Cadência = business_settings.jornada_manutencao_dias
 * (mesma do CRM — fonte única), fallback 60 dias.
 */

export interface SugestaoRetorno {
  servicoNome: string;
  servicoCode: string;
  agendavelOnline: boolean; // false p/ noiva/debutante → CTA WhatsApp (R1/R14)
  diasDesde: number;
}

/** Cadência de manutenção (dias) — mesma leitura do motor de jornadas. */
export async function cadenciaManutencaoDias(): Promise<number> {
  const row = await prisma.businessSetting.findUnique({
    where: { key: "jornada_manutencao_dias" },
  });
  const n = row ? Number(row.value as unknown) : NaN;
  return Number.isFinite(n) && n > 0 ? n : MANUTENCAO_DIAS_DEFAULT;
}

/**
 * Retorna a sugestão de retorno OU null (nada a sugerir). null quando: sem
 * atendimento concluído, dentro da cadência, ou já tem horário futuro.
 */
export async function getSugestaoRetorno(
  customerId: string,
): Promise<SugestaoRetorno | null> {
  // Já tem horário marcado? Então não empurra reagendamento.
  const futuro = await prisma.booking.findFirst({
    where: {
      customerId,
      status: { in: ["pending", "confirmed"] },
      startsAt: { gte: new Date() },
    },
    select: { id: true },
  });
  if (futuro) return null;

  const ultimo = await prisma.booking.findFirst({
    where: { customerId, status: "completed" },
    orderBy: { startsAt: "desc" },
    select: {
      startsAt: true,
      service: {
        select: { name: true, code: true, bookableOnline: true, active: true },
      },
    },
  });
  if (!ultimo) return null;

  const diasDesde = Math.floor(
    (Date.now() - ultimo.startsAt.getTime()) / (24 * 3600 * 1000),
  );
  const cadencia = await cadenciaManutencaoDias();
  if (diasDesde < cadencia) return null;

  return {
    servicoNome: ultimo.service.name,
    servicoCode: ultimo.service.code,
    agendavelOnline: ultimo.service.bookableOnline && ultimo.service.active,
    diasDesde,
  };
}
