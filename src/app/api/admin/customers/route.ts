import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * Busca de clientes para o encaixe manual (M10.1). Protegida — dados de
 * cliente (telefone) nunca saem sem autenticação (R18). Casa por nome ou
 * pelos dígitos do telefone.
 */
export async function GET(req: Request) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const q = new URL(req.url).searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) return NextResponse.json({ customers: [] });

  const digits = q.replace(/\D/g, "");
  const customers = await prisma.customer.findMany({
    where: {
      OR: [
        { name: { contains: q, mode: "insensitive" } },
        ...(digits.length >= 3 ? [{ phoneE164: { contains: digits } }] : []),
      ],
    },
    select: { id: true, name: true, phoneE164: true, strikes: true },
    orderBy: { name: "asc" },
    take: 8,
  });
  return NextResponse.json({ customers });
}
