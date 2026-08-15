import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatPhoneBR, waLink } from "@/lib/format";
import { getCrmConfig, nomesSegmentos } from "@/lib/crm-config";

export const dynamic = "force-dynamic";

const brl = (cents: number) =>
  (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  });


function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-mi-bege px-2 text-xs font-medium text-mi-marrom-escuro">
      {children}
    </span>
  );
}

export default async function CrmRfvPage({
  searchParams,
}: {
  searchParams: { seg?: string };
}) {
  // Nomes válidos vêm da régua editável (F2) + segmentos antigos ainda gravados.
  const SEGMENTOS = nomesSegmentos(await getCrmConfig());
  const seg =
    searchParams.seg &&
    (SEGMENTOS.includes(searchParams.seg) ||
      (await prisma.customer.count({
        where: { rfvSegmento: searchParams.seg },
      })) > 0)
      ? searchParams.seg
      : null;

  const clientes = await prisma.customer.findMany({
    // noivas/deb ficam fora da matriz, mesmo com score antigo (R2)
    where: {
      funilEtapa: null,
      ...(seg ? { rfvSegmento: seg } : { rfvSegmento: { not: null } }),
    },
    orderBy: [{ ltvPrevistoCents: "desc" }, { name: "asc" }],
    take: 300,
    select: {
      id: true,
      name: true,
      phoneE164: true,
      rScore: true,
      fScore: true,
      vScore: true,
      rfvSegmento: true,
      ltvPrevistoCents: true,
    },
  });

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl">Segmentos</h1>
        <Link href="/admin/crm" className="text-sm text-mi-marrom-escuro hover:underline">
          ← CRM
        </Link>
      </div>

      <div className="mb-5 flex flex-wrap gap-2 text-sm">
        <Link
          href="/admin/crm/rfv"
          className={`rounded-mi border px-3 py-1.5 ${!seg ? "border-mi-marrom bg-mi-marrom text-mi-branco" : "border-mi-cinza hover:bg-mi-bege/40"}`}
        >
          Todos
        </Link>
        {SEGMENTOS.map((s) => (
          <Link
            key={s}
            href={`/admin/crm/rfv?seg=${encodeURIComponent(s)}`}
            className={`rounded-mi border px-3 py-1.5 ${seg === s ? "border-mi-marrom bg-mi-marrom text-mi-branco" : "border-mi-cinza hover:bg-mi-bege/40"}`}
          >
            {s}
          </Link>
        ))}
      </div>

      {clientes.length === 0 ? (
        <p className="text-sm text-mi-texto/80">
          Nenhuma cliente {seg ? `no segmento "${seg}"` : "segmentada"} ainda.
        </p>
      ) : (
        <div className="space-y-2">
          {clientes.map((c) => (
            <div
              key={c.id}
              className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-mi bg-mi-branco px-4 py-3 shadow-suave"
            >
              <Link
                href={`/admin/clientes/${c.id}`}
                className="min-w-40 flex-1 font-medium text-mi-marrom-escuro hover:underline"
              >
                {c.name}
                {!seg && c.rfvSegmento && (
                  <span className="ml-2 text-xs font-normal text-mi-texto/80">
                    · {c.rfvSegmento}
                  </span>
                )}
              </Link>
              <span className="flex items-center gap-1 text-xs text-mi-texto/80">
                R<Pill>{c.rScore ?? "–"}</Pill>
                F<Pill>{c.fScore ?? "–"}</Pill>
                V<Pill>{c.vScore ?? "–"}</Pill>
              </span>
              <span className="w-24 text-right text-sm font-medium text-mi-marrom-escuro">
                {brl(c.ltvPrevistoCents ?? 0)}
              </span>
              <a
                href={waLink(c.phoneE164)}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-mi-marrom-escuro hover:underline"
              >
                {formatPhoneBR(c.phoneE164)}
              </a>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
