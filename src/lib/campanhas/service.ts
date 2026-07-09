import { prisma } from "../prisma";
import { enqueue, tentarEnviar } from "../whatsapp/service";
import { resolverSegmento, type SegmentoConfig } from "./segmento";
import { renderCampanha, type RenderOpts } from "./template";

/**
 * Motor das Campanhas (F2): disparo (real/teste), anti-spam global, conversão e
 * métricas, e avaliação das automáticas. O envio real passa SEMPRE pelo outbox
 * (WhatsAppService) como tipo=CAMPANHA — opt-out e throttle já aplicados lá.
 */

/** Anti-spam global: máx. 1 campanha por cliente a cada N dias (config.). */
const ANTISPAM_DIAS_DEFAULT = 14;

async function antispamDias(): Promise<number> {
  const row = await prisma.businessSetting.findUnique({
    where: { key: "campanha_antispam_dias" },
  });
  const n = row ? Number(row.value as unknown) : NaN;
  return Number.isFinite(n) && n > 0 ? n : ANTISPAM_DIAS_DEFAULT;
}

async function renderOpts(): Promise<RenderOpts> {
  return {
    siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? "https://miozorio.com.br",
    waMi: process.env.WHATSAPP_MI ?? "https://wa.me/5521970225231",
    servicoLink: null,
  };
}

/** Já recebeu QUALQUER campanha nos últimos `dias`? (anti-spam entre campanhas) */
export async function recebeuCampanhaRecente(
  clienteId: string,
  dias: number,
): Promise<boolean> {
  const desde = new Date(Date.now() - dias * 24 * 60 * 60 * 1000);
  const n = await prisma.whatsAppMessage.count({
    where: {
      clienteId,
      tipo: "CAMPANHA",
      criadoEm: { gte: desde },
      status: { in: ["QUEUED", "SENT", "DELIVERED"] },
    },
  });
  return n > 0;
}

export interface DisparoResumo {
  ok: boolean;
  message?: string;
  publico?: number;
  enfileirados?: number;
  pulados?: number;
  teste?: boolean;
}

/**
 * Dispara uma campanha PONTUAL. `teste` = envia a amostra renderizada só para
 * aquele número (o da Mi), sem tocar em clientes nem métricas.
 */
export async function dispararCampanha(
  id: string,
  opts?: { teste?: string },
): Promise<DisparoResumo> {
  const camp = await prisma.campanha.findUnique({ where: { id } });
  if (!camp) return { ok: false, message: "Campanha não encontrada." };

  const clientes = await resolverSegmento(camp.segmentoConfig as SegmentoConfig);
  const o = await renderOpts();

  if (opts?.teste) {
    const amostra = clientes.slice(0, 3);
    let n = 0;
    for (let i = 0; i < Math.max(1, amostra.length); i++) {
      const c = amostra[i];
      const texto = c
        ? `🧪 [TESTE] ${renderCampanha(camp.corpo, c, o)}`
        : `🧪 [TESTE] ${camp.corpo}`;
      const ok = await enqueue({
        telefone: opts.teste,
        texto,
        tipo: "TRANSACIONAL",
        templateKey: `campanha-teste:${id}`,
        dedupeKey: `camp-teste:${id}:${Date.now()}:${i}`,
      });
      if (ok && (await tentarEnviar(ok))) n++;
    }
    return { ok: true, teste: true, enfileirados: n, publico: clientes.length };
  }

  const dias = await antispamDias();
  let enfileirados = 0;
  let pulados = 0;
  for (const c of clientes) {
    if (await recebeuCampanhaRecente(c.id, dias)) {
      pulados++;
      continue;
    }
    const texto = renderCampanha(camp.corpo, c, o);
    const msgId = await enqueue({
      telefone: c.telefone,
      texto,
      tipo: "CAMPANHA",
      clienteId: c.id,
      templateKey: `campanha:${id}`,
      campanhaId: id,
      dedupeKey: `camp:${id}:${c.id}`,
    });
    try {
      await prisma.campanhaEnvio.create({
        data: { campanhaId: id, clienteId: c.id, whatsappMessageId: msgId ?? undefined },
      });
      enfileirados++;
    } catch {
      /* já existe (unique) */
    }
  }
  await prisma.campanha.update({ where: { id }, data: { status: "ATIVA" } });
  return { ok: true, publico: clientes.length, enfileirados, pulados };
}

// ── Automáticas (presets recorrentes) ────────────────────────────────────────

export interface Preset {
  recorrencia: string;
  nome: string;
  segmento: SegmentoConfig;
  corpo: string;
}

/** Presets prontos (F2.3). A Mi ativa/edita; nascem desativados (RASCUNHO). */
export const PRESETS_AUTOMATICOS: Preset[] = [
  {
    recorrencia: "sentimos_falta",
    nome: "Sentimos sua falta (45 dias)",
    segmento: { inatividadeDias: 45, apenasOptIn: true },
    corpo:
      "Oi {nome} 💛 Faz um tempinho que a gente não se vê! Que tal marcar um horário pra se cuidar? {link_agenda}",
  },
  {
    recorrencia: "aniversario",
    nome: "Aniversário",
    segmento: { aniversario: "semana", apenasOptIn: true },
    corpo:
      "Feliz aniversário, {nome}! 🎉 Preparamos um mimo em pontos no Clube pra você comemorar com a gente 💛",
  },
  {
    recorrencia: "recompra",
    nome: "Recompra de sobrancelha (25 dias)",
    segmento: { fezServico: ["sobrancelha-henna", "design-sobrancelha"], inatividadeDias: 25, apenasOptIn: true },
    corpo:
      "Oi {nome}! Já faz {dias_sem_vir} dias — hora de renovar o design da sobrancelha 💛 {link_agenda}",
  },
];

/**
 * Avalia campanhas AUTOMATICAS ativas: gera CampanhaEnvio pendente (sem enfileirar)
 * quando modoAprovacao; enfileira direto quando não. Respeita anti-spam. Idempotente
 * pela unique (campanha_id, cliente_id).
 */
export async function avaliarAutomaticas(): Promise<{ geradas: number; pendentes: number }> {
  const camps = await prisma.campanha.findMany({
    where: { tipo: "AUTOMATICA", status: "ATIVA" },
  });
  const dias = await antispamDias();
  const o = await renderOpts();
  let geradas = 0;
  let pendentes = 0;

  for (const camp of camps) {
    const clientes = await resolverSegmento(camp.segmentoConfig as SegmentoConfig);
    for (const c of clientes) {
      if (await recebeuCampanhaRecente(c.id, dias)) continue;
      const texto = renderCampanha(camp.corpo, c, o);
      try {
        if (camp.modoAprovacao) {
          // pendente (whatsappMessageId null) — Mi aprova depois
          await prisma.campanhaEnvio.create({
            data: { campanhaId: camp.id, clienteId: c.id },
          });
          pendentes++;
        } else {
          const msgId = await enqueue({
            telefone: c.telefone,
            texto,
            tipo: "CAMPANHA",
            clienteId: c.id,
            templateKey: `campanha:${camp.id}`,
            campanhaId: camp.id,
            dedupeKey: `camp:${camp.id}:${c.id}:${new Date().toISOString().slice(0, 10)}`,
          });
          await prisma.campanhaEnvio.create({
            data: { campanhaId: camp.id, clienteId: c.id, whatsappMessageId: msgId ?? undefined },
          });
          geradas++;
        }
      } catch {
        /* já existe */
      }
    }
  }
  return { geradas, pendentes };
}

/** Aprova os pendentes de uma campanha (modo aprovação): enfileira no outbox. */
export async function aprovarPendentes(campanhaId: string): Promise<number> {
  const camp = await prisma.campanha.findUnique({ where: { id: campanhaId } });
  if (!camp) return 0;
  const pend = await prisma.campanhaEnvio.findMany({
    where: { campanhaId, whatsappMessageId: null },
    select: { id: true, clienteId: true },
  });
  if (!pend.length) return 0;

  const clientes = await resolverSegmento(camp.segmentoConfig as SegmentoConfig);
  const porId = new Map(clientes.map((c) => [c.id, c]));
  const o = await renderOpts();
  let enfileirados = 0;
  for (const p of pend) {
    const c = porId.get(p.clienteId);
    if (!c) continue;
    const texto = renderCampanha(camp.corpo, c, o);
    const msgId = await enqueue({
      telefone: c.telefone,
      texto,
      tipo: "CAMPANHA",
      clienteId: c.id,
      templateKey: `campanha:${campanhaId}`,
      campanhaId,
      dedupeKey: `camp:${campanhaId}:${c.id}`,
    });
    await prisma.campanhaEnvio.update({
      where: { id: p.id },
      data: { whatsappMessageId: msgId ?? undefined },
    });
    if (msgId) enfileirados++;
  }
  return enfileirados;
}

// ── Conversão + métricas ─────────────────────────────────────────────────────

/**
 * Marca conversões: agendamento criado pelo cliente dentro da janela após o
 * envio. Receita = preço do 1º agendamento na janela. Roda no cron.
 */
export async function registrarConversoes(): Promise<number> {
  const rows = await prisma.$executeRawUnsafe(`
    UPDATE campanha_envio ce
    SET convertido_em = b.created_at, receita_cents = b.price_cents
    FROM whatsapp_message wm
    JOIN campanha c ON c.id = ce.campanha_id
    JOIN LATERAL (
      SELECT bk.created_at, bk.price_cents FROM bookings bk
      WHERE bk.customer_id = ce.cliente_id
        AND bk.created_at >= wm.enviado_em
        AND bk.created_at <= wm.enviado_em + (c.janela_conversao_dias || ' days')::interval
      ORDER BY bk.created_at ASC LIMIT 1
    ) b ON true
    WHERE ce.whatsapp_message_id = wm.id
      AND ce.campanha_id = c.id
      AND ce.convertido_em IS NULL
      AND wm.enviado_em IS NOT NULL
  `);
  return rows;
}

export interface MetricasCampanha {
  total: number;
  pendentes: number;
  enviadas: number;
  entregues: number;
  convertidas: number;
  receitaCents: number;
}

export async function metricasCampanha(id: string): Promise<MetricasCampanha> {
  const envios = await prisma.campanhaEnvio.findMany({
    where: { campanhaId: id },
    select: { whatsappMessageId: true, convertidoEm: true, receitaCents: true },
  });
  const ids = envios.map((e) => e.whatsappMessageId).filter(Boolean) as string[];
  const msgs = ids.length
    ? await prisma.whatsAppMessage.findMany({
        where: { id: { in: ids } },
        select: { status: true },
      })
    : [];
  return {
    total: envios.length,
    pendentes: envios.filter((e) => !e.whatsappMessageId).length,
    enviadas: msgs.filter((m) => m.status === "SENT" || m.status === "DELIVERED").length,
    entregues: msgs.filter((m) => m.status === "DELIVERED").length,
    convertidas: envios.filter((e) => e.convertidoEm).length,
    receitaCents: envios.reduce((s, e) => s + (e.receitaCents ?? 0), 0),
  };
}
