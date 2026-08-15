import Link from "next/link";
import { DateTime } from "luxon";
import { prisma } from "@/lib/prisma";
import { formatBRL, waLinkMsg } from "@/lib/format";
import { getCrmConfig } from "@/lib/crm-config";
import { getSiteContent, aplicarTemplate } from "@/lib/content";
import FunilBoard, { type CardFunil } from "./FunilBoard";

export const dynamic = "force-dynamic";

// Etapas do funil de noiva/debutante (nunca agendável online — R14).
const ETAPAS = [
  { etapa: "lead", label: "Lead" },
  { etapa: "previa_agendada", label: "Prévia agendada" },
  { etapa: "previa_feita", label: "Prévia feita" },
  { etapa: "contrato_fechado", label: "Contrato fechado" },
  { etapa: "evento", label: "Evento" },
  { etapa: "pos_evento", label: "Pós-evento" },
];

// Pipeline em negociação = antes do contrato; fechado = contrato em diante.
const NEGOCIACAO = ["lead", "previa_agendada", "previa_feita"];

/** F5 — funil 2.0: kanban arrastável + tempos + pipeline + alerta de parada. */
export default async function CrmFunilPage() {
  const [cfg, content, noivas, tempos] = await Promise.all([
    getCrmConfig(),
    getSiteContent(),
    prisma.customer.findMany({
      where: { funilEtapa: { not: null } },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        funilEtapa: true,
        funilEtapaDesde: true,
        funilValorCents: true,
        clubInterest: true,
        phoneE164: true,
      },
    }),
    // Tempo médio em cada etapa: da entrada (evento "para=X") até a PRÓXIMA
    // transição da mesma cliente. Sem próxima transição = ainda na etapa (fora).
    prisma.$queryRawUnsafe<{ etapa: string; dias: number }[]>(`
SELECT f.para AS etapa,
       AVG(EXTRACT(EPOCH FROM (prox.created_at - f.created_at)) / 86400)::float AS dias
FROM funil_eventos f
JOIN LATERAL (
  SELECT p.created_at FROM funil_eventos p
  WHERE p.customer_id = f.customer_id AND p.created_at > f.created_at
  ORDER BY p.created_at ASC LIMIT 1
) prox ON true
GROUP BY f.para`),
  ]);

  const agora = DateTime.now();
  const cards: CardFunil[] = noivas.map((c) => {
    const primeiro = c.name.split(" ")[0] ?? c.name;
    const tplKey = `msg.funil_${c.funilEtapa}`;
    const rascunho = aplicarTemplate(content[tplKey] ?? `Oi, ${primeiro}! 💛`, {
      nome: primeiro,
    });
    return {
      id: c.id,
      nome: c.name,
      interesse: c.clubInterest,
      etapa: String(c.funilEtapa),
      diasNaEtapa: c.funilEtapaDesde
        ? Math.floor(
            agora.diff(DateTime.fromJSDate(c.funilEtapaDesde), "days").days,
          )
        : null,
      valorReais:
        c.funilValorCents != null ? Math.round(c.funilValorCents / 100) : null,
      waHref: waLinkMsg(c.phoneE164, rascunho),
    };
  });

  const pipelineCents = noivas
    .filter((c) => NEGOCIACAO.includes(String(c.funilEtapa)))
    .reduce((s, c) => s + (c.funilValorCents ?? 0), 0);
  const fechadoCents = noivas
    .filter((c) => !NEGOCIACAO.includes(String(c.funilEtapa)))
    .reduce((s, c) => s + (c.funilValorCents ?? 0), 0);
  const paradas = cards.filter(
    (c) =>
      c.diasNaEtapa != null && c.diasNaEtapa >= cfg.limiares.funilParadaDias,
  ).length;
  const tempoMap = new Map(tempos.map((t) => [t.etapa, t.dias]));

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl">Jornada da noiva</h1>
        <Link href="/admin/crm" className="text-sm text-mi-marrom-escuro hover:underline">
          ← CRM
        </Link>
      </div>

      <section className="mb-6 grid grid-cols-3 gap-3">
        <div className="rounded-mi bg-mi-branco p-4 shadow-suave">
          <p className="text-xs uppercase tracking-wide text-mi-texto/80">
            Em negociação
          </p>
          <p className="mt-1 font-titulo text-2xl text-mi-marrom-escuro">
            {formatBRL(pipelineCents)}
          </p>
        </div>
        <div className="rounded-mi bg-mi-branco p-4 shadow-suave">
          <p className="text-xs uppercase tracking-wide text-mi-texto/80">
            Contratos fechados
          </p>
          <p className="mt-1 font-titulo text-2xl text-mi-marrom-escuro">
            {formatBRL(fechadoCents)}
          </p>
        </div>
        <div className="rounded-mi bg-mi-branco p-4 shadow-suave">
          <p className="text-xs uppercase tracking-wide text-mi-texto/80">
            Paradas há {cfg.limiares.funilParadaDias}+ dias
          </p>
          <p
            className={`mt-1 font-titulo text-2xl ${
              paradas > 0 ? "text-red-700" : "text-mi-marrom-escuro"
            }`}
          >
            {paradas}
          </p>
        </div>
      </section>

      {noivas.length === 0 ? (
        <p className="mb-5 text-sm text-mi-texto/80">
          Nenhuma noiva no funil ainda. Para incluir uma cliente, defina a etapa
          do funil na ficha dela.
        </p>
      ) : (
        <>
          <p className="mb-4 text-sm text-mi-texto/80">
            Arraste os cartões entre as etapas (ou use ◀ ▶ no celular). O botão
            de WhatsApp abre com um rascunho da etapa — você sempre edita antes
            de enviar. Valores alimentam o total em negociação.
          </p>
          <FunilBoard
            colunas={ETAPAS}
            cards={cards}
            paradaDias={cfg.limiares.funilParadaDias}
          />
        </>
      )}

      <section className="mt-8">
        <h2 className="mb-2 text-xl">Tempo médio em cada etapa</h2>
        {tempoMap.size === 0 ? (
          <p className="text-sm text-mi-texto/80">
            Ainda sem histórico — os tempos aparecem conforme as noivas mudam de
            etapa a partir de agora.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {ETAPAS.map((e) => {
              const d = tempoMap.get(e.etapa);
              return (
                <span
                  key={e.etapa}
                  className="rounded-full bg-mi-branco px-3 py-1.5 text-sm shadow-suave"
                >
                  {e.label}:{" "}
                  <strong>{d != null ? `${Math.round(d)} dia(s)` : "—"}</strong>
                </span>
              );
            })}
          </div>
        )}
      </section>
    </>
  );
}
