import { NextRequest, NextResponse } from "next/server";
import { cancelBody } from "@/lib/validation";
import { cancelBooking } from "@/lib/booking-service";

export const dynamic = "force-dynamic";

// POST /api/bookings/:id/cancel  → aplica policies.ts (prazo/strike/sinal)
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  let actor: "client" | "business" = "client";
  try {
    const json = await req.json();
    const parsed = cancelBody.safeParse(json);
    if (parsed.success) actor = parsed.data.actor;
  } catch {
    // corpo vazio → cancelamento da cliente (default)
  }

  const result = await cancelBooking(params.id, actor);
  if (!result.ok) {
    const status = result.code === "not_found" ? 404 : 409;
    return NextResponse.json(
      { error: result.message, code: result.code },
      { status },
    );
  }
  return NextResponse.json({
    status: result.status,
    depositRetained: result.depositRetained,
    requiresDeposit: result.requiresDeposit,
  });
}
