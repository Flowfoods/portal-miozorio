import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createHmac } from "crypto";
import { mercadoPago } from "@/lib/pagamento/mercadopago";
import { gatewayAtivo, pagamentoDisponivel } from "@/lib/pagamento";

const env = { ...process.env };
afterEach(() => {
  process.env = { ...env };
});

describe("A7 — sem credencial, NADA muda", () => {
  beforeEach(() => {
    delete process.env.PAGAMENTO_PROVIDER;
    delete process.env.MP_ACCESS_TOKEN;
  });

  it("sem provider configurado não há gateway", () => {
    expect(gatewayAtivo()).toBeNull();
    expect(pagamentoDisponivel()).toBe(false);
  });

  it("provider configurado mas SEM token também não", () => {
    // Meia configuração não pode virar uma tela de pagamento quebrada para a
    // cliente — melhor cair no caminho do WhatsApp.
    process.env.PAGAMENTO_PROVIDER = "mercadopago";
    expect(gatewayAtivo()).toBeNull();
  });

  it("provider desconhecido não vira gateway", () => {
    process.env.PAGAMENTO_PROVIDER = "efi";
    process.env.MP_ACCESS_TOKEN = "x";
    expect(gatewayAtivo()).toBeNull();
  });

  it("com provider + token, o gateway existe", () => {
    process.env.PAGAMENTO_PROVIDER = "mercadopago";
    process.env.MP_ACCESS_TOKEN = "TEST-123";
    expect(gatewayAtivo()?.nome).toBe("mercadopago");
  });
});

describe("A7 — assinatura do webhook (fail-closed)", () => {
  const gw = mercadoPago("TEST-123");
  const SEGREDO = "segredo-de-teste";

  function reqAssinado(
    dataId: string,
    opts: { ts?: string; requestId?: string; v1?: string } = {},
  ): Request {
    const ts = opts.ts ?? "1704908010";
    const requestId = opts.requestId ?? "req-abc";
    const manifesto = `id:${dataId};request-id:${requestId};ts:${ts};`;
    const v1 =
      opts.v1 ?? createHmac("sha256", SEGREDO).update(manifesto).digest("hex");
    return new Request(
      `https://miozorio.com.br/api/webhooks/pagamento?data.id=${dataId}`,
      { headers: { "x-signature": `ts=${ts},v1=${v1}`, "x-request-id": requestId } },
    );
  }

  beforeEach(() => {
    process.env.MP_WEBHOOK_SECRET = SEGREDO;
  });

  it("assinatura válida devolve o id da cobrança", async () => {
    const r = await gw.lerWebhook(reqAssinado("123456"), {});
    expect(r).toBe("123456");
  });

  it("assinatura forjada é recusada", async () => {
    const r = await gw.lerWebhook(
      reqAssinado("123456", { v1: "f".repeat(64) }),
      {},
    );
    expect(r).toBeNull();
  });

  it("trocar o id sem reassinar é recusado — senão daria para marcar QUALQUER cobrança como paga", async () => {
    const legitimo = reqAssinado("111");
    const adulterado = new Request(
      "https://miozorio.com.br/api/webhooks/pagamento?data.id=999",
      { headers: legitimo.headers },
    );
    expect(await gw.lerWebhook(adulterado, {})).toBeNull();
  });

  it("sem header de assinatura, recusa", async () => {
    const req = new Request(
      "https://miozorio.com.br/api/webhooks/pagamento?data.id=123",
    );
    expect(await gw.lerWebhook(req, {})).toBeNull();
  });

  it("SEM MP_WEBHOOK_SECRET recusa tudo — webhook sem verificação seria um botão de 'marcar como pago' aberto", async () => {
    delete process.env.MP_WEBHOOK_SECRET;
    expect(await gw.lerWebhook(reqAssinado("123456"), {})).toBeNull();
  });

  it("assinatura sem ts ou sem v1 é recusada", async () => {
    const req = new Request(
      "https://miozorio.com.br/api/webhooks/pagamento?data.id=123",
      { headers: { "x-signature": "v1=abc" } },
    );
    expect(await gw.lerWebhook(req, {})).toBeNull();
  });

  it("sem data.id não há o que confirmar", async () => {
    const ts = "1704908010";
    const v1 = createHmac("sha256", SEGREDO).update("x").digest("hex");
    const req = new Request("https://miozorio.com.br/api/webhooks/pagamento", {
      headers: { "x-signature": `ts=${ts},v1=${v1}` },
    });
    expect(await gw.lerWebhook(req, {})).toBeNull();
  });

  it("lê o data.id do corpo quando não vem na query", async () => {
    const ts = "1704908010";
    const manifesto = `id:777;request-id:;ts:${ts};`;
    const v1 = createHmac("sha256", SEGREDO).update(manifesto).digest("hex");
    const req = new Request("https://miozorio.com.br/api/webhooks/pagamento", {
      headers: { "x-signature": `ts=${ts},v1=${v1}` },
    });
    expect(await gw.lerWebhook(req, { data: { id: "777" } })).toBe("777");
  });
});
