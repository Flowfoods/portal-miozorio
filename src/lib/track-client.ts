/**
 * Beacon de tracking do lado do cliente (CRM 2.0 F1). First-party: só fala com
 * a própria /api/track. `keepalive` para sobreviver à navegação/fechamento.
 * Falha NUNCA quebra a UI (a analítica é secundária ao uso do site).
 */
export function trackClient(
  tipo: string,
  metadata?: Record<string, unknown>,
): void {
  if (typeof window === "undefined") return;
  try {
    fetch("/api/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tipo, metadata }),
      keepalive: true,
    }).catch(() => {});
  } catch {
    // sem rede / bloqueado: ignora
  }
}
