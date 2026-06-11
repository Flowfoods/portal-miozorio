import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// GET /api/services → serviços agendáveis online (exclui noiva/debutante, R1).
export async function GET() {
  const services = await prisma.service.findMany({
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
    },
    orderBy: [{ category: "asc" }, { priceCents: "asc" }],
  });
  return NextResponse.json({ services });
}
