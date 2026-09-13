import { NextResponse } from "next/server";
import { gatewayAtivo } from "@/lib/pagamento";
import { registrarSinalPago } from "@/lib/pagamento/conciliar";

export const dynamic = "force-dynamic";

/**
 * A7 — webhook do provedor de pagamento.
 *
 * Fail-closed em duas camadas: sem gateway configurado responde 404 (a rota
 * não deveria nem existir), e a autenticidade é decidida pelo adaptador
 * (`lerWebhook`), que exige assinatura válida. Um webhook de pagamento sem
 * verificação seria um botão de "marcar como pago" aberto na internet.
 *
 * Responde 200 mesmo em caso ignorado: provedor que recebe erro fica
 * reenviando, e o cron de conciliação já é a rede de segurança para o que se
 * perder.
 */
export async function POST(req: Request) {
  const gateway = gatewayAtivo();
  if (!gateway) {
    return NextResponse.json({ error: "não encontrado" }, { status: 404 });
  }

  const corpo = await req.json().catch(() => null);

  let cobrancaId: string | null = null;
  try {
    cobrancaId = await gateway.lerWebhook(req, corpo);
  } catch (e) {
    console.error("webhook pagamento: falha ao validar", e);
    cobrancaId = null;
  }

  if (!cobrancaId) {
    return NextResponse.json({ error: "não autorizado" }, { status: 401 });
  }

  try {
    // O webhook só diz "algo mudou nesta cobrança" — quem decide se está paga
    // é o provedor, perguntado por nós. Nunca confiar no corpo da notificação
    // para liberar um horário.
    const status = await gateway.consultarStatus(cobrancaId);
    if (status === "pago") {
      await registrarSinalPago(cobrancaId);
    }
  } catch (e) {
    console.error("webhook pagamento: falha ao processar", cobrancaId, e);
  }

  return NextResponse.json({ ok: true });
}
