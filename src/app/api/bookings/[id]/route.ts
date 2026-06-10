import { NextResponse } from "next/server";
import { getBookingStatus } from "@/lib/booking-service";

export const dynamic = "force-dynamic";

// GET /api/bookings/:id  → status (polling do checkout)
export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const booking = await getBookingStatus(params.id);
  if (!booking) {
    return NextResponse.json(
      { error: "Reserva não encontrada" },
      { status: 404 },
    );
  }
  return NextResponse.json(booking);
}
