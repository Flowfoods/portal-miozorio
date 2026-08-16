import { prisma } from "./prisma";

/**
 * Registro da última execução de cada cron.
 *
 * Os 11 crons calculavam um resumo bonito ({enviados, falhas, criadas…}) e o
 * devolviam em JSON para o Dokploy Schedule — que descarta a resposta. Erro de
 * cron caía em `console.error`, que ninguém lê. Na prática: se um job parasse
 * de rodar ou passasse a falhar, ninguém descobria até alguém notar o efeito
 * semanas depois.
 *
 * Grava em `business_settings` (chave/valor JSON) de propósito: a tabela já
 * existe, `settings.ts` ignora chaves que não conhece, e assim isto entra sem
 * migration — que é o tipo de mudança que colide entre sessões paralelas e só
 * explode no boot do container.
 */

const PREFIXO = "cron_ultima_execucao_";

export interface RegistroCron {
  quando: string;
  ok: boolean;
  duracaoMs: number;
  resumo?: unknown;
  erro?: string;
}

/**
 * Executa o job, cronometra e registra o resultado — inclusive quando falha.
 * Nunca engole a exceção: relança depois de gravar, para a rota devolver 500 e
 * o Dokploy marcar a execução como erro.
 */
export async function comRegistro<T>(
  nome: string,
  job: () => Promise<T>,
): Promise<T> {
  const inicio = Date.now();
  try {
    const resultado = await job();
    await gravar(nome, {
      quando: new Date().toISOString(),
      ok: true,
      duracaoMs: Date.now() - inicio,
      resumo: await resumoLegivel(resultado),
    });
    return resultado;
  } catch (e) {
    await gravar(nome, {
      quando: new Date().toISOString(),
      ok: false,
      duracaoMs: Date.now() - inicio,
      erro: String((e as { message?: string })?.message ?? e).slice(0, 300),
    });
    throw e;
  }
}

/**
 * As rotas devolvem `NextResponse`, que não serializa em nada útil. Como o
 * resumo (quantos enviados, quantas falhas) é justamente o que interessa saber
 * depois, extrai o corpo JSON antes de guardar. `clone()` porque o corpo da
 * resposta só pode ser lido uma vez — sem isso o cron devolveria vazio para o
 * Dokploy.
 */
async function resumoLegivel(r: unknown): Promise<unknown> {
  if (r instanceof Response) {
    try {
      return await r.clone().json();
    } catch {
      return { status: r.status };
    }
  }
  return r ?? null;
}

/** Falha ao registrar nunca derruba o job — o registro é meio, não fim. */
async function gravar(nome: string, r: RegistroCron): Promise<void> {
  try {
    await prisma.businessSetting.upsert({
      where: { key: PREFIXO + nome },
      update: { value: r as object },
      create: { key: PREFIXO + nome, value: r as object },
    });
  } catch {
    // silencioso por desenho
  }
}

/** Última execução de cada cron, para a tela de diagnóstico. */
export async function lerRegistros(): Promise<Record<string, RegistroCron>> {
  const rows = await prisma.businessSetting.findMany({
    where: { key: { startsWith: PREFIXO } },
  });
  const out: Record<string, RegistroCron> = {};
  for (const r of rows) {
    out[r.key.slice(PREFIXO.length)] = r.value as unknown as RegistroCron;
  }
  return out;
}
