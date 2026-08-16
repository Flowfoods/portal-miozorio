import { readFileSync } from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { lerRegistros } from "@/lib/cron-registro";

// Healthcheck do portal (M0.4). Usado no pós-deploy e pelo Uptime Kuma (M7).
export const dynamic = "force-dynamic";

/**
 * Identificador do build servido AGORA.
 *
 * `version` sempre devolveu "0.1.0" porque APP_VERSION nunca foi setada em
 * lugar nenhum (nem no Dockerfile, nem no entrypoint, nem no .env) — então a
 * única sonda pública do portal não respondia à única pergunta que importa
 * depois de um deploy: "o código novo subiu?". Sem isso, verificar release
 * virava adivinhação — sondar rota nova, comparar uptime de container, chutar.
 *
 * O BUILD_ID é gerado pelo Next a cada build e já vem dentro da imagem, então
 * muda sozinho a cada deploy, sem nenhuma configuração no Dokploy.
 * Lido uma vez por processo: o arquivo não muda enquanto o container vive.
 */
const BUILD = (() => {
  for (const p of [
    path.join(process.cwd(), ".next", "BUILD_ID"),
    path.join(process.cwd(), ".next", "standalone", ".next", "BUILD_ID"),
  ]) {
    try {
      const v = readFileSync(p, "utf8").trim();
      if (v) return v;
    } catch {
      // tenta o próximo caminho
    }
  }
  return "desconhecido";
})();

export async function GET(req: Request) {
  let db: "ok" | "fail" = "fail";
  try {
    await prisma.$queryRaw`SELECT 1`;
    db = "ok";
  } catch {
    db = "fail";
  }

  // Detalhe operacional só com o segredo do cron na query — a resposta base é
  // pública (Uptime Kuma bate nela) e não deve contar a rotina da casa.
  const segredo = process.env.CRON_SECRET;
  const pediu = new URL(req.url).searchParams.get("token");
  const detalhado = !!segredo && pediu === segredo;

  let crons: Record<string, { quando: string; ok: boolean }> | undefined;
  if (detalhado && db === "ok") {
    try {
      const regs = await lerRegistros();
      crons = Object.fromEntries(
        Object.entries(regs).map(([k, v]) => [
          k,
          { quando: v.quando, ok: v.ok },
        ]),
      );
    } catch {
      crons = undefined;
    }
  }

  const body = {
    app: "ok" as const,
    db,
    build: BUILD,
    // Segundos desde que ESTE processo subiu. É o "Up 8 weeks" do container
    // visto de dentro — dá para saber que o deploy recriou o processo sem
    // precisar abrir o painel.
    uptimeS: Math.round(process.uptime()),
    // Só a PRESENÇA da env, nunca o valor: cron fail-closed que não roda por
    // falta de segredo é silencioso demais para se descobrir por acaso.
    cronSecret: process.env.CRON_SECRET ? ("ok" as const) : ("ausente" as const),
    version: process.env.APP_VERSION ?? "0.1.0",
    ts: new Date().toISOString(),
    ...(crons ? { crons } : {}),
  };

  return NextResponse.json(body, { status: db === "ok" ? 200 : 503 });
}
