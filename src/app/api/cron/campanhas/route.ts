import { NextResponse } from "next/server";
import { cronAuthorized } from "@/lib/security";
import { prisma } from "@/lib/prisma";
import {
  avaliarAutomaticas,
  dispararCampanha,
  registrarConversoes,
} from "@/lib/campanhas/service";

/**
 * Cron das campanhas (F2/F3): dispara as PONTUAIS agendadas já devidas, avalia
 * gatilhos das automáticas (envios ou pendentes p/ aprovação) e marca conversões
 * da janela. Dokploy Schedules (1×/dia). Fail-closed por CRON_SECRET.
 */
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!cronAuthorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  // Agendadas devidas → dispara (vira ATIVA dentro do dispararCampanha).
  const devidas = await prisma.campanha.findMany({
    where: { tipo: "PONTUAL", status: "AGENDADA", agendadaPara: { lte: new Date() } },
    select: { id: true },
  });
  let agendadasDisparadas = 0;
  for (const c of devidas) {
    const r = await dispararCampanha(c.id);
    if (r.ok) agendadasDisparadas++;
  }
  const auto = await avaliarAutomaticas();
  const conversoes = await registrarConversoes();
  return NextResponse.json({ ok: true, agendadasDisparadas, ...auto, conversoes });
}
