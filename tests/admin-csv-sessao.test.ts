import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Export CSV das listas do CRM (`/admin/crm/listas/csv`) — a rota que entrega
 * NOME + WHATSAPP de toda a base num arquivo.
 *
 * Achado da verificação pós-revisão (15/09/2026): ela conferia `!session`,
 * e a sessão revogada NÃO é `null`. O callback `session` do NextAuth devolve
 * `{ ...session, user: undefined }` quando o `tokenVersion` não bate ou a
 * conta foi desativada — objeto verdadeiro. A guarda passava e o CSV baixava.
 *
 * As rotas irmãs (`media`, `financeiro/anexo`) sempre conferiram
 * `session?.user?.email`; só esta ficou para trás.
 */

const H = vi.hoisted(() => ({
  sessao: null as { user?: { email?: string } } | null,
  consultouBanco: false,
}));

vi.mock("@/lib/auth", () => ({
  getAdminSession: async () => H.sessao,
}));

vi.mock("@/lib/crm-config", () => ({
  getCrmConfig: async () => {
    H.consultouBanco = true;
    return { limiares: { sumidaDias: 60, leadFriaDias: 30 } };
  },
}));

vi.mock("@/lib/crm-listas", () => ({
  clientesSumidas: async () => {
    H.consultouBanco = true;
    return [
      {
        name: "Cliente Teste",
        phoneE164: "+5521998626845",
        diasSemVir: 90,
        totalGastoCents: 45000,
        rfvSegmento: "Sumida",
      },
    ];
  },
  leadsNuncaEntraram: async () => [],
  visitouNaoMarcou: async () => [],
  engajadasIndicacao: async () => [],
  explorarClientes: async () => [],
}));

import { GET } from "@/app/admin/crm/listas/csv/route";
import { NextRequest } from "next/server";

const pedir = (tipo = "sumidas") =>
  GET(
    new NextRequest(
      `https://miozorio.com.br/admin/crm/listas/csv?tipo=${tipo}`,
    ),
  );

describe("CSV das listas do CRM — só sessão viva baixa a base", () => {
  beforeEach(() => {
    H.sessao = null;
    H.consultouBanco = false;
  });

  it("sessão viva baixa o CSV", async () => {
    H.sessao = { user: { email: "mi@miozorio.com.br" } };
    const res = await pedir();
    expect(res.status).toBe(200);
    const texto = await res.text();
    expect(texto).toContain("Cliente Teste");
    expect(res.headers.get("content-type")).toContain("text/csv");
  });

  it("senha trocada em outro aparelho (sessão sem user): 401, sem tocar no banco", async () => {
    // É exatamente o que o callback `session` devolve quando o tokenVersion
    // não bate ou a conta foi desativada — e o que `!session` deixava passar.
    H.sessao = { user: undefined };
    const res = await pedir();
    expect(res.status).toBe(401);
    expect(H.consultouBanco).toBe(false);
    expect(await res.text()).not.toContain("998626845");
  });

  it("sessão sem e-mail: 401", async () => {
    H.sessao = { user: {} };
    expect((await pedir()).status).toBe(401);
  });

  it("sem sessão nenhuma: 401", async () => {
    expect((await pedir()).status).toBe(401);
  });

  it("a recusa vale para todas as listas, não só a primeira", async () => {
    H.sessao = { user: undefined };
    for (const tipo of [
      "sumidas",
      "leads",
      "visitou",
      "indicacao",
      "explorar",
      "tipo-que-nao-existe",
    ]) {
      expect((await pedir(tipo)).status, tipo).toBe(401);
    }
    expect(H.consultouBanco).toBe(false);
  });
});
