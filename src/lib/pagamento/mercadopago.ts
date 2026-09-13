import { createHmac, timingSafeEqual } from "crypto";
import type {
  GatewayPagamento,
  NovaCobranca,
  CobrancaPix,
  StatusPagamento,
} from "./tipos";

/**
 * Adaptador do Mercado Pago (PIX).
 *
 * Escolhido como primeiro adaptador por ser o que a Mi já usa para receber, e
 * porque a API de `payments` cobre PIX com QR + copia-e-cola numa única
 * chamada. Trocar por Efí é escrever `efi.ts` com a mesma interface.
 *
 * Sem `MP_ACCESS_TOKEN`, este módulo nunca é instanciado (ver `index.ts`).
 */

const API = "https://api.mercadopago.com";

/** Chuta o sobrenome quando a cliente informou só o primeiro nome. */
function partirNome(nome: string): { first: string; last: string } {
  const partes = nome.trim().split(/\s+/);
  return {
    first: partes[0] ?? "Cliente",
    last: partes.slice(1).join(" ") || partes[0] || "Cliente",
  };
}

export function mercadoPago(accessToken: string): GatewayPagamento {
  async function chamar(
    path: string,
    init: RequestInit & { idempotencia?: string } = {},
  ): Promise<Record<string, unknown>> {
    const { idempotencia, ...rest } = init;
    const res = await fetch(`${API}${path}`, {
      ...rest,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        // Sem isto, um retry de rede cria DUAS cobranças para a mesma reserva.
        ...(idempotencia ? { "X-Idempotency-Key": idempotencia } : {}),
        ...(rest.headers ?? {}),
      },
      cache: "no-store",
    });
    const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) {
      throw new Error(
        `mercadopago ${path} ${res.status}: ${JSON.stringify(body).slice(0, 300)}`,
      );
    }
    return body;
  }

  return {
    nome: "mercadopago",

    async criarCobrancaPix(input: NovaCobranca): Promise<CobrancaPix> {
      const { first, last } = partirNome(input.pagadorNome);
      const expira = new Date(Date.now() + input.expiraEmMinutos * 60_000);

      const body = await chamar("/v1/payments", {
        method: "POST",
        // Idempotência pelo BOOKING: se a cliente recarregar a tela do PIX, o
        // MP devolve a mesma cobrança em vez de abrir outra.
        idempotencia: `booking-${input.bookingId}`,
        body: JSON.stringify({
          transaction_amount: Number((input.valorCents / 100).toFixed(2)),
          description: input.descricao,
          payment_method_id: "pix",
          date_of_expiration: expira.toISOString(),
          external_reference: input.bookingId,
          payer: {
            // O MP exige e-mail; sem o da cliente, um endereço técnico do
            // domínio evita recusa da cobrança por campo vazio.
            email: input.pagadorEmail || `reserva+${input.bookingId}@miozorio.com.br`,
            first_name: first,
            last_name: last,
          },
        }),
      });

      const tx = (body.point_of_interaction as Record<string, unknown> | undefined)
        ?.transaction_data as Record<string, unknown> | undefined;

      const copiaECola = String(tx?.qr_code ?? "");
      if (!copiaECola) {
        throw new Error("mercadopago: resposta sem qr_code");
      }

      return {
        id: String(body.id),
        copiaECola,
        qrCodeBase64: tx?.qr_code_base64
          ? `data:image/png;base64,${String(tx.qr_code_base64)}`
          : null,
        expiraEm: expira,
      };
    },

    async consultarStatus(cobrancaId: string): Promise<StatusPagamento> {
      const body = await chamar(`/v1/payments/${cobrancaId}`);
      const status = String(body.status ?? "");
      if (status === "approved") return "pago";
      if (status === "cancelled" || status === "rejected") return "cancelado";
      // O MP não tem "expirado" explícito no status principal.
      if (
        status === "expired" ||
        String(body.status_detail ?? "") === "expired"
      ) {
        return "expirado";
      }
      return "pendente";
    },

    /**
     * Valida a assinatura `x-signature` do MP (HMAC-SHA256 sobre
     * `id:<id>;request-id:<x-request-id>;ts:<ts>;`) e devolve o id da cobrança.
     *
     * Fail-closed de verdade: sem `MP_WEBHOOK_SECRET` configurado, recusa —
     * um webhook de pagamento sem verificação é um botão de "marcar como pago"
     * aberto na internet.
     */
    async lerWebhook(req: Request, corpo: unknown): Promise<string | null> {
      const segredo = process.env.MP_WEBHOOK_SECRET;
      if (!segredo) return null;

      const assinatura = req.headers.get("x-signature");
      const requestId = req.headers.get("x-request-id") ?? "";
      if (!assinatura) return null;

      // "ts=1704908010,v1=618c85345248dd820d5fd456117c2ab2ef8eda45…"
      const partes = Object.fromEntries(
        assinatura.split(",").map((p) => {
          const [k, v] = p.split("=");
          return [k?.trim() ?? "", v?.trim() ?? ""];
        }),
      );
      const ts = partes.ts;
      const v1 = partes.v1;
      if (!ts || !v1) return null;

      const url = new URL(req.url);
      const dataId =
        url.searchParams.get("data.id") ??
        String(
          ((corpo as Record<string, unknown>)?.data as Record<string, unknown>)
            ?.id ?? "",
        );
      if (!dataId) return null;

      const manifesto = `id:${dataId};request-id:${requestId};ts:${ts};`;
      const esperado = createHmac("sha256", segredo)
        .update(manifesto)
        .digest("hex");

      const a = Buffer.from(esperado, "utf8");
      const b = Buffer.from(v1, "utf8");
      if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

      return dataId;
    },
  };
}
