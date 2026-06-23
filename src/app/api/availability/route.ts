import { NextRequest, NextResponse } from "next/server";
import { availabilityQuery } from "@/lib/validation";
import { getAvailability } from "@/lib/availability";

export const dynamic = "force-dynamic";

// GET /api/availability?serviceId=&date=YYYY-MM-DD&location=studio|home&durationMin=
export async function GET(req: NextRequest) {
  const parsed = availabilityQuery.safeParse(
    Object.fromEntries(req.nextUrl.searchParams),
  );
  if (!parsed.success) {
    return NextResponse.json({ error: "Parâmetros inválidos" }, { status: 400 });
  }
  const slots = await getAvailability(
    parsed.data.serviceId,
    parsed.data.date,
    parsed.data.durationMin,
  );
  return NextResponse.json({ date: parsed.data.date, slots });
}
