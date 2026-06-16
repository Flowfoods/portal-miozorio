import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// GET /api/services → serviços agendáveis online (exclui noiva/debutante, R1).
export async function GET() {
  const rows = await prisma.service.findMany({
    where: { active: true, bookableOnline: true },
    select: {
      id: true,
      code: true,
      name: true,
      category: true,
      durationMin: true,
      priceCents: true,
      priceHomeCents: true,
      pendingPrice: true,
      isCourse: true,
      availability: { select: { weekday: true } },
    },
    orderBy: [{ category: "asc" }, { priceCents: "asc" }],
  });

  // M9.5 — dias próprios do serviço (Luxon 1=seg..7=dom). null = usa a regra
  // padrão do wizard (curso = qualquer dia; senão fim de semana).
  const services = rows.map(({ availability, ...s }) => ({
    ...s,
    availableWeekdays: availability.length
      ? Array.from(new Set(availability.map((a) => a.weekday))).sort(
          (x, y) => x - y,
        )
      : null,
  }));
  return NextResponse.json({ services });
}
