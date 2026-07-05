import { DateTime } from "luxon";
import { prisma } from "./prisma";
import { aplicarTemplate } from "./content";
import { getCrmConfig, type CrmConfigData } from "./crm-config";
import { clientesSumidas, leadsNuncaEntraram } from "./crm-listas";
import { EV } from "./tracking";

/**
 * CRM 2.0 F4 — réguas de reativação em modo SUGESTÃO (regra da casa, definida
 * pelo Rodolfo): a régua NUNCA envia; ela cria itens `aguardando` na fila
 * /admin/crm/mensagens com um texto proposto, que a Mi SEMPRE pode editar e
 * personalizar antes de enviar. Ritmo e quantidade vêm da config dela:
 *   - intervaloPorClienteDias: ninguém recebe sugestão se teve mensagem
 *     (enviada OU já na fila) há menos de N dias;
 *   - maxSugestoesPorDia: teto diário de sugestões novas;
 *   - opt-in de WhatsApp obrigatório (LGPD);
 *   - dedup mensal por régua+cliente (R10).
 */

export type Regua = "sumida" | "abandono" | "leadFria";

export const REGUA_KIND: Record<Regua, string> = {
  sumida: "regua_sumida",
  abandono: "regua_abandono",
  leadFria: "regua_lead_fria",
};

export const REGUA_LABEL: Record<string, string> = {
  regua_sumida: "Cliente sumida",
  regua_abandono: "Não concluiu o agendamento",
  regua_lead_fria: "Boas-vindas (nunca acessou)",
  // jornadas (mesma fila desde a F4)
  boas_vindas: "Boas-vindas (1º atendimento)",
  manutencao: "Hora de se cuidar de novo",
  reativacao: "Reativação (em risco)",
};

/** Chave de dedupe mensal: 1 sugestão por régua+cliente por mês (R10). */
export function dedupKeyRegua(regua: Regua, clienteId: string, ref: Date): string {
  const mes = DateTime.fromJSDate(ref).setZone("America/Sao_Paulo").toFormat("yyyy-LL");
  return `${REGUA_KIND[regua]}:${clienteId}:${mes}`;
}

interface Candidata {
  clienteId: string;
  nome: string;
  vars: Record<string, string>;
}

/** Candidatas por régua (sem os filtros comuns — aplicados depois). */
async function candidatas(regua: Regua, cfg: CrmConfigData): Promise<Candidata[]> {
  if (regua === "sumida") {
    const rows = await clientesSumidas(cfg.limiares.sumidaDias);
    return rows.map((r) => ({
      clienteId: r.id,
      nome: r.name,
      vars: { nome: r.name.split(" ")[0] ?? r.name, dias: String(r.diasSemVir) },
    }));
  }
  if (regua === "leadFria") {
    const rows = await leadsNuncaEntraram(cfg.limiares.leadFriaDias);
    return rows.map((r) => ({
      clienteId: r.id,
      nome: r.name,
      vars: { nome: r.name.split(" ")[0] ?? r.name, dias: String(r.criadaHaDias) },
    }));
  }
  // abandono: abandonou o agendamento entre 1 e 3 dias atrás (D+1, sem spam de
  // quem abandonou há semanas) e não concluiu/agendou desde então. Fora do
  // funil de noiva/debutante (R14 — esses fluxos são só WhatsApp direto).
  const rows = await prisma.$queryRawUnsafe<{ id: string; name: string }[]>(`
SELECT DISTINCT c.id, c.name
FROM customers c
JOIN client_events e ON e.client_id = c.id
  AND e.tipo = '${EV.ABANDONOU_AGENDAMENTO}'
  AND e.created_at BETWEEN now() - INTERVAL '3 days' AND now() - INTERVAL '1 day'
WHERE c.funil_etapa IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM client_events e2 WHERE e2.client_id = c.id
      AND e2.tipo = '${EV.AGENDAMENTO_CONCLUIDO}' AND e2.created_at >= now() - INTERVAL '3 days')
  AND NOT EXISTS (
    SELECT 1 FROM bookings b WHERE b.customer_id = c.id
      AND b.created_at >= now() - INTERVAL '3 days'
      AND b.status IN ('pending', 'confirmed', 'completed'))
LIMIT 100`);
  return rows.map((r) => ({
    clienteId: r.id,
    nome: r.name,
    vars: { nome: r.name.split(" ")[0] ?? r.name, dias: "" },
  }));
}

export interface ResumoSugestoes {
  criadas: number;
  puladasTeto: number;
  puladasIntervalo: number;
  puladasOptOut: number;
  porRegua: Record<string, number>;
}

/**
 * Gera as sugestões do dia (cron diário e botão da fila). Nunca envia nada.
 */
export async function gerarSugestoes(): Promise<ResumoSugestoes> {
  const cfg = await getCrmConfig();
  const resumo: ResumoSugestoes = {
    criadas: 0,
    puladasTeto: 0,
    puladasIntervalo: 0,
    puladasOptOut: 0,
    porRegua: {},
  };

  // Teto diário conta o que JÁ foi sugerido hoje (idempotência do cron).
  const hoje = DateTime.now().setZone("America/Sao_Paulo").startOf("day");
  const criadasHoje = await prisma.envioMensagem.count({
    where: {
      kind: { in: Object.values(REGUA_KIND) },
      createdAt: { gte: hoje.toUTC().toJSDate() },
    },
  });
  let orcamento = Math.max(0, cfg.reguas.maxSugestoesPorDia - criadasHoje);

  const agora = new Date();
  for (const regua of ["sumida", "abandono", "leadFria"] as Regua[]) {
    if (!cfg.reguas.ativas[regua]) continue;
    const template = cfg.reguas.templates[regua];
    for (const cand of await candidatas(regua, cfg)) {
      if (orcamento <= 0) {
        resumo.puladasTeto++;
        continue;
      }
      const cliente = await prisma.customer.findUnique({
        where: { id: cand.clienteId },
        select: { whatsappOptIn: true },
      });
      if (!cliente?.whatsappOptIn) {
        resumo.puladasOptOut++;
        continue;
      }
      // Intervalo por cliente: nada se recebeu/esta na fila há < N dias.
      const recente = await prisma.envioMensagem.findFirst({
        where: {
          customerId: cand.clienteId,
          status: { in: ["aguardando", "pendente", "enviado"] },
          createdAt: {
            gte: DateTime.fromJSDate(agora)
              .minus({ days: cfg.reguas.intervaloPorClienteDias })
              .toJSDate(),
          },
        },
        select: { id: true },
      });
      if (recente) {
        resumo.puladasIntervalo++;
        continue;
      }
      try {
        await prisma.envioMensagem.create({
          data: {
            customerId: cand.clienteId,
            kind: REGUA_KIND[regua],
            status: "aguardando",
            texto: aplicarTemplate(template, cand.vars),
            dedupKey: dedupKeyRegua(regua, cand.clienteId, agora),
          },
        });
        resumo.criadas++;
        resumo.porRegua[regua] = (resumo.porRegua[regua] ?? 0) + 1;
        orcamento--;
      } catch {
        // dedup mensal (R10) — já sugerido este mês
      }
    }
  }
  return resumo;
}
