import { NextResponse } from "next/server";
import { confirmBooking } from "@/lib/booking-service";

export const dynamic = "force-dynamic";

const STATUS_BY_CODE: Record<string, number> = {
  not_found: 404,
  not_pending: 409,
  hold_expired: 410,
  requires_deposit: 402,
};

// POST /api/bookings/:id/confirm  → pending → confirmed (valida hold + sinal)
export async function POST(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const result = await confirmBooking(params.id);
  if (!result.ok) {
    const status = STATUS_BY_CODE[result.code] ?? 400;
    return NextResponse.json(
      { error: result.message, code: result.code },
      { status },
    );
  }
  return NextResponse.json({ status: result.status });
}
