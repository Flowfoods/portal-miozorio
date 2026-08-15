import { NextRequest, NextResponse } from "next/server";
import { availabilityQuery } from "@/lib/validation";
import { getAvailability } from "@/lib/availability";
import { getAdminSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

// GET /api/availability?serviceId=&date=YYYY-MM-DD&location=studio|home&durationMin=
export async function GET(req: NextRequest) {
  const parsed = availabilityQuery.safeParse(
    Object.fromEntries(req.nextUrl.searchParams),
  );
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Parâmetros inválidos" },
      { status: 400 },
    );
  }
  // `durationMin` existe para o encaixe multi-serviço do painel. Vindo de fora,
  // permitia pedir a agenda com duração menor que a real e receber horários que
  // estouram o fim do expediente. Só a Mi (sessão de admin) pode sobrescrever.
  const admin = await getAdminSession();
  const duracao = admin ? parsed.data.durationMin : undefined;

  const slots = await getAvailability(
    parsed.data.serviceId,
    parsed.data.date,
    duracao,
  );
  return NextResponse.json({ date: parsed.data.date, slots });
}
