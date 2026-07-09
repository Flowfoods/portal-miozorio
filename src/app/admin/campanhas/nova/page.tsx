import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import CampanhaBuilder from "@/components/admin/CampanhaBuilder";

export const dynamic = "force-dynamic";

export default async function NovaCampanhaPage() {
  await requireAdmin();
  const [servicos, segs, templates] = await Promise.all([
    prisma.service.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      select: { code: true, name: true },
    }),
    prisma.customer.findMany({
      where: { rfvSegmento: { not: null } },
      distinct: ["rfvSegmento"],
      select: { rfvSegmento: true },
    }),
    prisma.campanhaTemplate.findMany({
      orderBy: { criadoEm: "asc" },
      select: { id: true, nome: true, corpo: true },
    }),
  ]);
  const rfvSegmentos = segs
    .map((s) => s.rfvSegmento)
    .filter((x): x is string => !!x);

  return (
    <>
      <div className="mb-2">
        <Link href="/admin/campanhas" className="text-sm text-mi-marrom underline">
          ← Campanhas
        </Link>
      </div>
      <h1 className="mb-6 text-3xl">Nova campanha</h1>
      <CampanhaBuilder
        servicos={servicos}
        rfvSegmentos={rfvSegmentos}
        templates={templates}
      />
    </>
  );
}
