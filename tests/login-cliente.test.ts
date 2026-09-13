import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import bcrypt from "bcryptjs";

/**
 * B1/B4 — login da cliente ponta a ponta contra um Prisma falso. Cobre as três
 * causas do "senha certa e o login não entra": telefone deformado, senha com
 * espaço nas pontas e sessão que não sobrevive. Mais os limites do B4.
 */

const H = vi.hoisted(() => ({
  customers: [] as Record<string, unknown>[],
  authLogs: [] as Record<string, unknown>[],
  cookies: new Map<string, { value: string; opts: Record<string, unknown> }>(),
}));

vi.mock("@/lib/prisma", () => {
  type Row = Record<string, unknown>;
  const bate = (row: Row, where: Row): boolean =>
    Object.entries(where).every(([k, cond]) => {
      const v = row[k];
      if (cond === null) return v === null || v === undefined;
      if (cond instanceof Date)
        return (v as Date)?.getTime?.() === cond.getTime();
      if (cond && typeof cond === "object") {
        const c = cond as Row;
        if ("not" in c) return c.not === null ? v != null : v !== c.not;
        if ("gte" in c) return (v as Date) >= (c.gte as Date);
        if ("in" in c) return (c.in as unknown[]).includes(v);
      }
      return v === cond;
    });
  const aplica = (row: Row, data: Row): void => {
    for (const [k, v] of Object.entries(data)) {
      if (v && typeof v === "object" && "increment" in (v as Row)) {
        row[k] = (Number(row[k]) || 0) + Number((v as Row).increment);
      } else row[k] = v;
    }
  };
  return {
    prisma: {
      customer: {
        findUnique: async ({ where }: { where: Row }) =>
          H.customers.find((r) => bate(r, where)) ?? null,
        update: async ({ where, data }: { where: Row; data: Row }) => {
          const row = H.customers.find((r) => bate(r, where));
          if (!row) throw new Error("cliente não encontrada");
          aplica(row, data);
          return row;
        },
      },
      authLog: {
        create: async ({ data }: { data: Row }) => {
          H.authLogs.push({ ...data, createdAt: new Date() });
          return {};
        },
        count: async ({ where }: { where: Row }) =>
          H.authLogs.filter((r) => bate(r, where)).length,
        findMany: async ({ where, take }: { where: Row; take?: number }) => {
          const achados = H.authLogs
            .filter((r) => bate(r, where))
            .sort(
              (a, b) =>
                (b.createdAt as Date).getTime() -
                (a.createdAt as Date).getTime(),
            );
          return take ? achados.slice(0, take) : achados;
        },
      },
    },
  };
});

vi.mock("next/headers", () => ({
  cookies: () => ({
    get: (n: string) =>
      H.cookies.has(n)
        ? { name: n, value: H.cookies.get(n)!.value }
        : undefined,
    set: (n: string, v: string, opts: Record<string, unknown> = {}) => {
      if (v === "") H.cookies.delete(n);
      else H.cookies.set(n, { value: v, opts });
    },
    delete: (n: string) => H.cookies.delete(n),
  }),
  headers: () =>
    new Headers({ "x-forwarded-for": "203.0.113.9", "user-agent": "vitest" }),
}));

// Tracking é best-effort e não faz parte do que está sendo testado.
vi.mock("@/lib/tracking", () => ({
  EV: { LOGIN_CLUBE: "login_clube" },
  getSid: () => "sid-teste",
  mergeAnonToClient: async () => {},
  track: async () => {},
}));

import {
  loginCliente,
  getClienteSession,
  setClientePassword,
  logoutCliente,
} from "@/lib/cliente-auth";

const TEL = "+5521998626845";
const ID = "11111111-1111-1111-1111-111111111111";
const SENHA = "minhaSenha123";
const HASH = bcrypt.hashSync(SENHA, 12);

function semear(extra: Record<string, unknown> = {}) {
  H.customers.length = 0;
  H.authLogs.length = 0;
  H.cookies.clear();
  H.customers.push({
    id: ID,
    name: "Ana Paula Souza",
    phoneE164: TEL,
    clubJoinedAt: new Date("2026-01-01T12:00:00Z"),
    clubPasswordHash: HASH,
    clubPasswordProvisoria: false,
    clubFailedLogins: 0,
    clubLockedUntil: null,
    clubConsentAt: new Date("2026-01-01T12:00:00Z"),
    clubTokenVersion: 0,
    ...extra,
  });
}

beforeEach(() => {
  process.env.NEXTAUTH_SECRET = "segredo-de-teste-para-o-hmac-do-cookie";
  semear();
});
afterEach(() => {
  vi.useRealTimers();
});

// ─────────────────────────────────────────────────────────────────────────────
describe("B1 — entra com o telefone em qualquer formato", () => {
  it.each([
    "(21) 99862-6845",
    "21998626845",
    "+55 21 99862-6845",
    " 21 99862 6845 ",
    "5521998626845",
  ])("%s entra com a senha certa", async (formato) => {
    semear();
    const r = await loginCliente(formato, SENHA);
    expect(r).toEqual({ ok: true, mustChange: false });
    expect(H.cookies.has("mi_clube")).toBe(true);
  });

  it("telefone que não é número brasileiro nem chega ao banco", async () => {
    const r = await loginCliente("123", SENHA);
    expect(r).toMatchObject({ ok: false });
    expect(H.authLogs).toHaveLength(0);
  });
});

describe("B1 — senha: trim nas pontas, nada no meio", () => {
  it("com espaço no fim, entra", async () => {
    expect(await loginCliente(TEL, `${SENHA} `)).toMatchObject({ ok: true });
  });

  it("com espaço no começo e quebra de linha, entra", async () => {
    expect(await loginCliente(TEL, `  ${SENHA}\n`)).toMatchObject({ ok: true });
  });

  it("senha gravada COM espaço não é invalidada — e se normaliza sozinha", async () => {
    // Cenário real: a cliente criou a senha colando com espaço no fim. Antes do
    // trim, o hash guardado é o do valor com espaço. Ela continua entrando
    // exatamente como sempre entrou (digitando o espaço)...
    semear({ clubPasswordHash: bcrypt.hashSync(`${SENHA} `, 12) });
    expect(await loginCliente(TEL, `${SENHA} `)).toMatchObject({ ok: true });

    // ...e nesse login o hash é regravado já normalizado, de graça.
    const novo = String(H.customers[0]!.clubPasswordHash);
    expect(bcrypt.compareSync(SENHA, novo)).toBe(true);

    // A partir daí tanto faz digitar com ou sem o espaço.
    semear({ clubPasswordHash: novo });
    expect(await loginCliente(TEL, SENHA)).toMatchObject({ ok: true });
    expect(await loginCliente(TEL, `${SENHA} `)).toMatchObject({ ok: true });
  });

  it("espaço NO MEIO faz parte da senha", async () => {
    semear({ clubPasswordHash: bcrypt.hashSync("mi nha senha", 12) });
    expect(await loginCliente(TEL, " mi nha senha ")).toMatchObject({
      ok: true,
    });
    expect(await loginCliente(TEL, "minhasenha")).toMatchObject({ ok: false });
  });

  it("senha vazia não vira tentativa contra o banco", async () => {
    expect(await loginCliente(TEL, "   ")).toMatchObject({ ok: false });
  });
});

describe("B1 — mensagens dizem o que fazer", () => {
  it("senha errada: 'Senha incorreta' e caminho para o código", async () => {
    const r = await loginCliente(TEL, "outraCoisa");
    expect(r).toMatchObject({ ok: false, sugestao: "recuperar" });
    if (!r.ok) expect(r.message).toContain("Senha incorreta");
  });

  it("telefone não cadastrado: convite para se cadastrar", async () => {
    const r = await loginCliente("(21) 90000-0000", SENHA);
    expect(r).toMatchObject({ ok: false, sugestao: "cadastrar" });
    if (!r.ok) expect(r.message).toContain("Não encontrei esse telefone");
  });

  it("quem não é do Clube recebe a mesma orientação de cadastro", async () => {
    semear({ clubJoinedAt: null });
    expect(await loginCliente(TEL, SENHA)).toMatchObject({
      ok: false,
      sugestao: "cadastrar",
    });
  });

  it("conta pausada: diz quantos minutos faltam, nunca trava em silêncio", async () => {
    semear({ clubLockedUntil: new Date(Date.now() + 7 * 60_000) });
    const r = await loginCliente(TEL, SENHA);
    expect(r).toMatchObject({ ok: false, sugestao: "aguardar" });
    if (!r.ok) expect(r.message).toMatch(/em 7 min/);
  });
});

describe("B4 — 11ª tentativa em 15 min pausa o telefone", () => {
  it("bloqueia com o tempo de espera na mensagem", async () => {
    // 10 falhas já registradas neste telefone (o motor conta o auth_log).
    for (let i = 0; i < 10; i++) {
      H.authLogs.push({
        area: "cliente",
        event: "login_fail",
        identifier: "••••6845",
        createdAt: new Date(Date.now() - i * 30_000),
      });
    }
    const r = await loginCliente(TEL, SENHA); // senha CERTA e mesmo assim pausa
    expect(r).toMatchObject({ ok: false, sugestao: "aguardar" });
    if (!r.ok) expect(r.message).toMatch(/Tente de novo em \d+ min/);
    expect(H.cookies.has("mi_clube")).toBe(false);
  });

  it("falhas de outro telefone não pausam este", async () => {
    for (let i = 0; i < 10; i++) {
      H.authLogs.push({
        area: "cliente",
        event: "login_fail",
        identifier: "••••0000",
        createdAt: new Date(),
      });
    }
    expect(await loginCliente(TEL, SENHA)).toMatchObject({ ok: true });
  });
});

describe("B1 — cookie de sessão", () => {
  it("httpOnly, SameSite=Lax, Path=/ e 30 dias", async () => {
    await loginCliente(TEL, SENHA);
    const opts = H.cookies.get("mi_clube")!.opts;
    expect(opts.httpOnly).toBe(true);
    expect(opts.sameSite).toBe("lax");
    expect(opts.path).toBe("/");
    expect(opts.maxAge).toBe(30 * 24 * 60 * 60);
    expect(opts.domain).toBeUndefined(); // host-only: o canônico resolve www
  });

  it("sair apaga o cookie", async () => {
    await loginCliente(TEL, SENHA);
    logoutCliente();
    expect(H.cookies.has("mi_clube")).toBe(false);
    expect(await getClienteSession()).toBeNull();
  });

  it("cookie adulterado não vira sessão", async () => {
    await loginCliente(TEL, SENHA);
    const atual = H.cookies.get("mi_clube")!;
    H.cookies.set("mi_clube", { value: `${atual.value}x`, opts: {} });
    expect(await getClienteSession()).toBeNull();
  });

  it("a sessão vence sozinha depois de 30 dias", async () => {
    await loginCliente(TEL, SENHA);
    expect(await getClienteSession()).not.toBeNull();
    vi.useFakeTimers();
    vi.setSystemTime(new Date(Date.now() + 31 * 24 * 60 * 60_000));
    expect(await getClienteSession()).toBeNull();
  });
});

describe("B4 — trocar a senha derruba as outras sessões", () => {
  it("o cookie do outro aparelho para de valer", async () => {
    await loginCliente(TEL, SENHA);
    const outroAparelho = H.cookies.get("mi_clube")!;

    const r = await setClientePassword("senhaNovaDela1", true);
    expect(r).toMatchObject({ ok: true });
    expect(H.customers[0]!.clubTokenVersion).toBe(1);

    // Este aparelho continua logado (cookie renovado na própria troca)…
    expect(await getClienteSession()).not.toBeNull();
    // …e o cookie antigo, não.
    H.cookies.set("mi_clube", outroAparelho);
    expect(await getClienteSession()).toBeNull();
  });

  it("a senha nova não pode ser o telefone, com ou sem DDI", async () => {
    await loginCliente(TEL, SENHA);
    expect(await setClientePassword("21998626845", true)).toMatchObject({
      ok: false,
    });
    expect(await setClientePassword("5521998626845", true)).toMatchObject({
      ok: false,
    });
  });

  it("a senha nova precisa de 6 caracteres", async () => {
    await loginCliente(TEL, SENHA);
    expect(await setClientePassword("abc", true)).toMatchObject({ ok: false });
  });
});

describe("B1 — primeiro acesso (senha = telefone)", () => {
  it("entra com o telefone e é mandada para criar a senha", async () => {
    semear({ clubPasswordHash: null, clubPasswordProvisoria: true });
    expect(await loginCliente(TEL, "21998626845")).toEqual({
      ok: true,
      mustChange: true,
    });
  });

  it("aceita também com o DDI na frente", async () => {
    semear({ clubPasswordHash: null, clubPasswordProvisoria: true });
    expect(await loginCliente(TEL, "5521998626845")).toMatchObject({
      ok: true,
    });
  });

  it("depois de definir a senha, o telefone deixa de servir", async () => {
    semear({ clubPasswordHash: null, clubPasswordProvisoria: false });
    expect(await loginCliente(TEL, "21998626845")).toMatchObject({ ok: false });
  });
});

describe("B4 — hash fraco sobe sozinho no login certo", () => {
  it("custo 10 vira custo 12 sem pedir nada à cliente", async () => {
    semear({ clubPasswordHash: bcrypt.hashSync(SENHA, 10) });
    expect(await loginCliente(TEL, SENHA)).toMatchObject({ ok: true });
    const novo = String(H.customers[0]!.clubPasswordHash);
    expect(novo.startsWith("$2a$12$") || novo.startsWith("$2b$12$")).toBe(true);
    expect(bcrypt.compareSync(SENHA, novo)).toBe(true);
  });
});
