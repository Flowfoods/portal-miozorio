import Link from "next/link";
import { DateTime } from "luxon";
import { prisma } from "@/lib/prisma";
import {
  getCrmConfig,
  crmConfigSchema,
  diffCrmConfig,
  DEFAULT_CRM_CONFIG,
  type CrmConfigData,
} from "@/lib/crm-config";
import ReguaEditor from "./ReguaEditor";

export const dynamic = "force-dynamic";

/**
 * CRM 2.0 F2 — Configurações do CRM: régua RFV editável pela Mi (faixas,
 * segmentos com nomes livres, limiares de alerta), prévia antes de salvar,
 * recálculo imediato e histórico de alterações (quem/quando/de→para).
 */
export default async function CrmConfigPage() {
  const [cfg, versoes] = await Promise.all([
    getCrmConfig(true),
    prisma.crmConfig.findMany({
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
  ]);

  // Diffs entre versões consecutivas (a mais nova compara com a anterior).
  const historico = versoes.map((v, i) => {
    const parse = (x: unknown): CrmConfigData | null => {
      const p = crmConfigSchema.safeParse(x);
      return p.success ? p.data : null;
    };
    const atual = parse(v.config);
    const anterior =
      i + 1 < versoes.length ? parse(versoes[i + 1]!.config) : DEFAULT_CRM_CONFIG;
    const mudancas =
      atual && anterior ? diffCrmConfig(anterior, atual) : ["(versão ilegível)"];
    return {
      id: v.id,
      quando: DateTime.fromJSDate(v.createdAt)
        .setZone("America/Sao_Paulo")
        .setLocale("pt-BR")
        .toFormat("dd/LL/yyyy 'às' HH:mm"),
      quem: v.criadoPor ?? "—",
      mudancas: mudancas.length ? mudancas : ["Salvo sem mudanças"],
    };
  });

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl">Configurações do CRM</h1>
        <Link
          href="/admin/crm"
          className="text-sm text-mi-marrom-escuro hover:underline"
        >
          ← CRM
        </Link>
      </div>
      <p className="mb-6 max-w-2xl text-sm text-mi-texto/80">
        Aqui você define o que faz uma cliente ser Campeã, Fiel ou estar
        sumida — do seu jeito. Use a prévia para ver o efeito antes de salvar;
        ao salvar, todas as clientes são reclassificadas na hora.
      </p>

      <ReguaEditor initial={cfg} />

      <section className="mt-10">
        <h2 className="mb-3 text-xl">Histórico de alterações</h2>
        {historico.length === 0 && (
          <p className="rounded-mi bg-mi-branco p-4 text-sm text-mi-texto/80 shadow-suave">
            Nenhuma alteração salva ainda — valem os padrões do sistema.
          </p>
        )}
        <div className="space-y-3">
          {historico.map((h) => (
            <div key={h.id} className="rounded-mi bg-mi-branco p-4 shadow-suave">
              <p className="text-sm font-medium">
                {h.quando}{" "}
                <span className="font-normal text-mi-texto/80">
                  · {h.quem}
                </span>
              </p>
              <ul className="mt-1 list-inside list-disc text-sm text-mi-texto/80">
                {h.mudancas.map((m, i) => (
                  <li key={i}>{m}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
