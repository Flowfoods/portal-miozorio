import Link from "next/link";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// Etapas do funil de noiva/debutante (nunca agendável online — R14).
const ETAPAS: { etapa: string; label: string }[] = [
  { etapa: "lead", label: "Lead" },
  { etapa: "previa_agendada", label: "Prévia agendada" },
  { etapa: "previa_feita", label: "Prévia feita" },
  { etapa: "contrato_fechado", label: "Contrato fechado" },
  { etapa: "evento", label: "Evento" },
  { etapa: "pos_evento", label: "Pós-evento" },
];

export default async function CrmFunilPage() {
  const noivas = await prisma.customer.findMany({
    where: { funilEtapa: { not: null } },
    orderBy: { name: "asc" },
    select: { id: true, name: true, funilEtapa: true, clubInterest: true },
  });

  const porEtapa = new Map<string, typeof noivas>();
  for (const e of ETAPAS) porEtapa.set(e.etapa, []);
  for (const c of noivas) {
    if (c.funilEtapa) porEtapa.get(c.funilEtapa)?.push(c);
  }

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl">Funil de noiva</h1>
        <Link href="/admin/crm" className="text-sm text-mi-marrom hover:underline">
          ← CRM
        </Link>
      </div>

      {noivas.length === 0 && (
        <p className="mb-5 text-sm text-mi-texto/60">
          Nenhuma noiva no funil ainda. Para incluir uma cliente, defina a etapa
          do funil na ficha dela.
        </p>
      )}

      {/* Board: rola na horizontal no mobile, colunas no desktop. */}
      <div className="-mx-1 flex gap-3 overflow-x-auto pb-2 lg:grid lg:grid-cols-6 lg:overflow-visible">
        {ETAPAS.map((e) => {
          const itens = porEtapa.get(e.etapa) ?? [];
          return (
            <div
              key={e.etapa}
              className="min-w-56 flex-1 rounded-mi bg-mi-bege/40 p-3 lg:min-w-0"
            >
              <p className="mb-2 flex items-center justify-between text-sm font-medium text-mi-marrom-escuro">
                {e.label}
                <span className="text-xs text-mi-texto/60">{itens.length}</span>
              </p>
              <div className="space-y-2">
                {itens.map((c) => (
                  <Link
                    key={c.id}
                    href={`/admin/clientes/${c.id}`}
                    className="block rounded-mi bg-mi-branco px-3 py-2 text-sm shadow-suave hover:bg-mi-bege/40"
                  >
                    <span className="font-medium text-mi-marrom-escuro">{c.name}</span>
                    {c.clubInterest && (
                      <span className="mt-0.5 block text-xs text-mi-texto/60">
                        {c.clubInterest}
                      </span>
                    )}
                  </Link>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
