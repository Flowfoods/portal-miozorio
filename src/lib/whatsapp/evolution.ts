/**
 * Camada de baixo nível da Evolution (envio HTTP direto). Fica na base da
 * hierarquia de imports para o WhatsAppService poder usá-la sem ciclo com
 * notify.ts (que a reexporta por retrocompatibilidade).
 */

/** True se as 3 envs da Evolution estão setadas (URL/KEY/INSTANCE). */
export function evolutionConfigured(): boolean {
  return !!(
    process.env.EVOLUTION_API_URL &&
    process.env.EVOLUTION_API_KEY &&
    process.env.EVOLUTION_INSTANCE
  );
}

/**
 * Envia UM texto pela Evolution (sendText). Fonte única do request HTTP. Lança
 * se a Evolution não estiver configurada ou se a API responder erro; quem chama
 * decide o tratamento (best-effort).
 */
export async function sendEvolutionText(
  number: string,
  text: string,
): Promise<void> {
  const base = process.env.EVOLUTION_API_URL;
  const apikey = process.env.EVOLUTION_API_KEY;
  const instance = process.env.EVOLUTION_INSTANCE;
  if (!base || !apikey || !instance) {
    throw new Error("Evolution não configurada");
  }
  const res = await fetch(
    `${base.replace(/\/$/, "")}/message/sendText/${instance}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey },
      body: JSON.stringify({ number, text }),
    },
  );
  if (!res.ok) throw new Error(`Evolution respondeu ${res.status}`);
}
