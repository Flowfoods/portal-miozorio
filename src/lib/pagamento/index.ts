import type { GatewayPagamento } from "./tipos";
import { mercadoPago } from "./mercadopago";

export type { GatewayPagamento, CobrancaPix, StatusPagamento } from "./tipos";

/**
 * A7 — o gateway ativo, ou `null`.
 *
 * `null` é o estado NORMAL até a Mi decidir o provedor e as credenciais
 * entrarem no Dokploy. Com null, o portal se comporta exatamente como antes:
 * a reserva com sinal nasce guardada e a combinação acontece no WhatsApp dela.
 * Nenhuma cliente vê um botão "Pagar" que não leva a lugar nenhum.
 *
 * Trocar para Efí = escrever `efi.ts` com a mesma interface e apontar aqui.
 */
export function gatewayAtivo(): GatewayPagamento | null {
  const provider = (process.env.PAGAMENTO_PROVIDER ?? "").toLowerCase();
  if (provider === "mercadopago") {
    const token = process.env.MP_ACCESS_TOKEN;
    // Sem token não há gateway — melhor cair no caminho do WhatsApp do que
    // quebrar a tela da cliente com um 500 na hora de pagar.
    return token ? mercadoPago(token) : null;
  }
  return null;
}

/** Conveniência para as telas: dá para cobrar pelo portal agora? */
export function pagamentoDisponivel(): boolean {
  return gatewayAtivo() !== null;
}
