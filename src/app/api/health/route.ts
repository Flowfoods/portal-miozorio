import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Healthcheck do portal (M0.4). Usado no pós-deploy e pelo Uptime Kuma (M7).
export const dynamic = "force-dynamic";

export async function GET() {
  let db: "ok" | "fail" = "fail";
  try {
    await prisma.$queryRaw`SELECT 1`;
    db = "ok";
  } catch {
    db = "fail";
  }

  const body = {
    app: "ok" as const,
    db,
    version: process.env.APP_VERSION ?? "0.1.0",
    ts: new Date().toISOString(),
  };

  return NextResponse.json(body, { status: db === "ok" ? 200 : 503 });
}
