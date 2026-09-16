import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

/**
 * B3 — CICLO DE VIDA do código de recuperação, ponta a ponta, contra um Prisma
 * falso em memória. É o teste que reproduz o print da Mi: código confirmado,
 * 10 minutos escolhendo a senha, salvar. Antes dava "Seu código expirou".
 *
 * O que é falsificado: banco, cookies/headers, envio pela Evolution e as
 * configurações. A lógica testada é a de verdade (`src/lib/recuperacao.ts`).
 */

const H = vi.hoisted(() => ({
  customers: [] as Record<string, unknown>[],
  admins: [] as Record<string, unknown>[],
  recoveries: [] as Record<string, unknown>[],
  cookies: new Map<string, string>(),
  enviados: [] as { telefone: string; texto: string; dedupeKey: string }[],
  falharEnvio: false,
  minutosValidade: 60,
}));

// ── Prisma falso ─────────────────────────────────────────────────────────────
vi.mock("@/lib/prisma", () => {
  type Row = Record<string, unknown>;

  const bate = (row: Row, where: Row): boolean =>
    Object.entries(where).every(([k, cond]) => {
      const v = row[k];
      if (cond === null) return v === null || v === undefined;
      if (cond instanceof Date)
        return (v as Date)?.getTime?.() === cond.getTime();
      if (cond && typeof cond === "object") {
        const c = cond as Record<string, unknown>;
        if ("not" in c) return c.not === null ? v != null : v !== c.not;
        if ("gte" in c) return (v as Date) >= (c.gte as Date);
        if ("gt" in c) return (v as Date) > (c.gt as Date);
        if ("lte" in c) return (v as Date) <= (c.lte as Date);
        if ("lt" in c) return (v as number) < (c.lt as number);
        if ("in" in c) return (c.in as unknown[]).includes(v);
      }
      return v === cond;
    });

  const aplica = (row: Row, data: Row): void => {
    for (const [k, v] of Object.entries(data)) {
      if (v && typeof v === "object" && "increment" in (v as Row)) {
        row[k] = (Number(row[k]) || 0) + Number((v as Row).increment);
      } else {
        row[k] = v;
      }
    }
  };

  const recentesPrimeiro = (a: Row, b: Row) =>
    (b.createdAt as Date).getTime() - (a.createdAt as Date).getTime();

  // Leituras devolvem CÓPIA, como um banco de verdade: quem leu uma linha não
  // enxerga o que outra requisição gravou depois. Com o objeto vivo, o
  // read-modify-write de `attempts` NÃO era reproduzível — cada chamada em
  // paralelo lia o valor já atualizado pela anterior e a corrida sumia.
  const tabela = (linhas: Row[]) => ({
    findUnique: async ({ where }: { where: Row }) => {
      const r = linhas.find((r) => bate(r, where));
      return r ? { ...r } : null;
    },
    findFirst: async ({
      where,
      orderBy,
    }: {
      where: Row;
      orderBy?: unknown;
    }) => {
      const achados = linhas.filter((r) => bate(r, where));
      if (orderBy) achados.sort(recentesPrimeiro);
      return achados[0] ? { ...achados[0] } : null;
    },
    findMany: async ({ where }: { where?: Row } = {}) =>
      where ? linhas.filter((r) => bate(r, where)) : [...linhas],
    count: async ({ where }: { where?: Row } = {}) =>
      where ? linhas.filter((r) => bate(r, where)).length : linhas.length,
    create: async ({ data }: { data: Row }) => {
      const row: Row = {
        id: `id-${linhas.length + 1}-${Math.random().toString(36).slice(2, 8)}`,
        attempts: 0,
        usedAt: null,
        notifiedAt: null,
        notifyError: null,
        exchangeHash: null,
        exchangeExpiresAt: null,
        lastSentAt: new Date(),
        createdAt: new Date(),
        ...data,
      };
      linhas.push(row);
      return row;
    },
    update: async ({ where, data }: { where: Row; data: Row }) => {
      const row = linhas.find((r) => bate(r, where));
      if (!row) throw new Error("linha não encontrada");
      aplica(row, data);
      return row;
    },
    updateMany: async ({ where, data }: { where: Row; data: Row }) => {
      const alvos = linhas.filter((r) => bate(r, where));
      alvos.forEach((r) => aplica(r, data));
      return { count: alvos.length };
    },
  });

  return {
    prisma: {
      customer: tabela(H.customers),
      adminUser: tabela(H.admins),
      passwordRecovery: tabela(H.recoveries),
      authLog: {
        create: async () => ({}),
        count: async () => 0,
        findMany: async () => [],
      },
      clientEvent: { create: async () => ({}) },
    },
  };
});

// ── Cookies e headers do Next ────────────────────────────────────────────────
vi.mock("next/headers", () => ({
  cookies: () => ({
    get: (n: string) =>
      H.cookies.has(n) ? { name: n, value: H.cookies.get(n)! } : undefined,
    set: (n: string, v: string) => {
      if (v === "") H.cookies.delete(n);
      else H.cookies.set(n, v);
    },
    delete: (n: string) => H.cookies.delete(n),
  }),
  headers: () =>
    new Headers({ "x-forwarded-for": "203.0.113.9", "user-agent": "vitest" }),
}));

// ── Evolution (WhatsApp da Mi) ───────────────────────────────────────────────
vi.mock("@/lib/whatsapp/service", () => ({
  sendTransactional: async (input: {
    telefone: string;
    texto: string;
    dedupeKey: string;
  }) => {
    if (H.falharEnvio) return false; // fica QUEUED no outbox real
    H.enviados.push(input);
    return true;
  },
}));

// ── Configurações da Mi ──────────────────────────────────────────────────────
vi.mock("@/lib/settings", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/settings")>();
  return {
    ...real,
    getSettings: async () => ({
      timezone: "America/Sao_Paulo",
      recuperacaoCodigoMin: H.minutosValidade,
    }),
  };
});

import {
  pedirCodigo,
  salvarNovaSenha,
  verificarCodigo,
  gerarCodigoParaCliente,
  MAX_PEDIDOS_HORA,
} from "@/lib/recuperacao";
import bcrypt from "bcryptjs";

// ── Cenário ──────────────────────────────────────────────────────────────────
const TEL = "+5521998626845";
const CLIENTE_ID = "11111111-1111-1111-1111-111111111111";
const ADMIN_ID = "22222222-2222-2222-2222-222222222222";

function semear() {
  H.customers.length = 0;
  H.admins.length = 0;
  H.recoveries.length = 0;
  H.cookies.clear();
  H.enviados.length = 0;
  H.falharEnvio = false;
  H.minutosValidade = 60;

  H.customers.push({
    id: CLIENTE_ID,
    name: "Ana Paula Souza",
    phoneE164: TEL,
    email: "ana@exemplo.com",
    clubJoinedAt: new Date("2026-01-01T12:00:00Z"),
    clubPasswordHash: bcrypt.hashSync("senhaAntiga1", 12),
    clubPasswordProvisoria: false,
    clubFailedLogins: 0,
    clubLockedUntil: null,
    clubConsentAt: new Date("2026-01-01T12:00:00Z"),
    clubTokenVersion: 3,
    createdAt: new Date("2026-01-01T12:00:00Z"),
  });
  H.admins.push({
    id: ADMIN_ID,
    name: "Mi",
    email: "mi@miozorio.com.br",
    passwordHash: bcrypt.hashSync("senhaAntigaDoPainel1", 12),
    active: true,
    failedAttempts: 0,
    lockedUntil: null,
    tokenVersion: 7,
    createdAt: new Date("2026-01-01T12:00:00Z"),
  });
}

/** Lê o código da mensagem que a Mi recebeu — é o que ela faz na vida real. */
function codigoRecebidoPelaMi(): string {
  const ultima = H.enviados.at(-1);
  const m = /Código: (\d{6})/.exec(ultima?.texto ?? "");
  if (!m) throw new Error("a Mi não recebeu código nenhum");
  return m[1]!;
}

const T0 = new Date("2026-09-13T13:30:00-03:00");
const avancar = (min: number) =>
  vi.setSystemTime(new Date(Date.now() + min * 60_000));

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(T0);
  process.env.MI_WHATSAPP = "+5521970225231";
  process.env.NEXTAUTH_SECRET = "segredo-de-teste-para-o-hmac-do-cookie";
  semear();
});
afterEach(() => {
  vi.useRealTimers();
});

// ─────────────────────────────────────────────────────────────────────────────
describe("B2 — o código vai para a Mi, nunca direto para a pessoa", () => {
  it("a Mi recebe com nome, número cadastrado, código e prazo", async () => {
    await pedirCodigo("(21) 99862-6845");
    expect(H.enviados).toHaveLength(1);
    const msg = H.enviados[0]!;
    expect(msg.telefone).toBe("5521970225231"); // WhatsApp da Mi
    expect(msg.telefone).not.toBe(TEL.replace("+", ""));
    expect(msg.texto).toContain("Ana Paula Souza");
    expect(msg.texto).toContain("(21) 99862-6845");
    expect(msg.texto).toMatch(/Código: \d{6}/);
    expect(msg.texto).toContain("Vale até 14:30");
  });

  it("funciona com o telefone digitado em qualquer formato", async () => {
    for (const formato of [
      "21998626845",
      "+55 21 99862-6845",
      " 21 99862 6845 ",
    ]) {
      H.recoveries.length = 0;
      H.enviados.length = 0;
      await pedirCodigo(formato);
      expect(H.enviados).toHaveLength(1);
    }
  });

  it("número não cadastrado: nada é enviado e nada é gravado", async () => {
    await pedirCodigo("(21) 90000-0000");
    expect(H.enviados).toHaveLength(0);
    expect(H.recoveries).toHaveLength(0);
  });

  it("guarda só o hash do código — nunca o código em claro", async () => {
    await pedirCodigo(TEL);
    const codigo = codigoRecebidoPelaMi();
    const linha = H.recoveries[0]!;
    expect(linha.codeHash).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(linha)).not.toContain(codigo);
  });

  it("também registra IP hasheado e user-agent, nunca o IP cru", async () => {
    await pedirCodigo(TEL);
    const linha = H.recoveries[0]!;
    expect(linha.ipHash).toMatch(/^[0-9a-f]{64}$/);
    expect(linha.ipHash).not.toContain("203.0.113.9");
    expect(linha.userAgent).toBe("vitest");
    expect(linha.notifiedAt).toBeInstanceOf(Date);
  });
});

describe("B2 — falha da Evolution não quebra o fluxo", () => {
  it("a pessoa segue para o passo do código e o pedido fica no log", async () => {
    H.falharEnvio = true;
    await expect(pedirCodigo(TEL)).resolves.toBeUndefined();
    expect(H.recoveries).toHaveLength(1);
    expect(H.recoveries[0]!.notifiedAt).toBeNull();
    expect(String(H.recoveries[0]!.notifyError)).toContain("fila");
  });
});

describe("B3 — o caso do print: confirmar, demorar, salvar", () => {
  it("verificar NÃO consome; salvar 10 min depois funciona", async () => {
    await pedirCodigo(TEL);
    const codigo = codigoRecebidoPelaMi();

    // A Mi repassa 40 min depois — o código de 10 min morria aqui.
    avancar(40);
    const conferido = await verificarCodigo(TEL, codigo);
    expect(conferido.ok).toBe(true);
    expect(H.recoveries[0]!.usedAt).toBeNull(); // ainda vivo

    // A cliente demora 10 min escolhendo a senha na tela.
    avancar(10);
    const salvo = await salvarNovaSenha("senhaNova123");
    expect(salvo).toMatchObject({ ok: true, perfil: "cliente" });

    const c = H.customers[0]!;
    expect(bcrypt.compareSync("senhaNova123", String(c.clubPasswordHash))).toBe(
      true,
    );
    expect(H.recoveries[0]!.usedAt).toBeInstanceOf(Date);
  });

  it("erro de regra na tela de senha não queima a chance", async () => {
    await pedirCodigo(TEL);
    await verificarCodigo(TEL, codigoRecebidoPelaMi());

    const curta = await salvarNovaSenha("123");
    expect(curta).toMatchObject({ ok: false });
    const igualAoTelefone = await salvarNovaSenha("21998626845");
    expect(igualAoTelefone).toMatchObject({ ok: false });

    avancar(5);
    expect(await salvarNovaSenha("senhaNova123")).toMatchObject({ ok: true });
  });

  it("a cliente já sai logada, com a sessão na versão nova", async () => {
    await pedirCodigo(TEL);
    await verificarCodigo(TEL, codigoRecebidoPelaMi());
    await salvarNovaSenha("senhaNova123");

    expect(H.cookies.get("mi_clube")).toBeTruthy();
    expect(H.customers[0]!.clubTokenVersion).toBe(4); // era 3 → derruba as outras
    expect(H.customers[0]!.clubPasswordProvisoria).toBe(false);
  });

  it("passados os 15 min da confirmação, a mensagem diz a hora e oferece novo", async () => {
    await pedirCodigo(TEL);
    await verificarCodigo(TEL, codigoRecebidoPelaMi());
    avancar(16);
    const r = await salvarNovaSenha("senhaNova123");
    expect(r).toMatchObject({ ok: false, pedirNovo: true });
    if (!r.ok) expect(r.message).toMatch(/venceu às \d{2}:\d{2}/);
  });

  it("código com 70 min: mensagem com a hora do vencimento", async () => {
    await pedirCodigo(TEL);
    const codigo = codigoRecebidoPelaMi();
    avancar(70);
    const r = await verificarCodigo(TEL, codigo);
    expect(r).toMatchObject({ ok: false, pedirNovo: true });
    if (!r.ok) expect(r.message).toContain("venceu às 14:30");
  });

  it("a validade segue o que a Mi configurou (piso de 15 min)", async () => {
    H.minutosValidade = 5; // abaixo do piso → vira 15
    await pedirCodigo(TEL);
    const codigo = codigoRecebidoPelaMi();
    avancar(14);
    expect((await verificarCodigo(TEL, codigo)).ok).toBe(true);
  });
});

describe("B3 — uso único e invalidação", () => {
  it("código já usado não serve de novo", async () => {
    await pedirCodigo(TEL);
    const codigo = codigoRecebidoPelaMi();
    await verificarCodigo(TEL, codigo);
    await salvarNovaSenha("senhaNova123");

    H.cookies.clear();
    const r = await verificarCodigo(TEL, codigo);
    expect(r.ok).toBe(false);
  });

  it("o cookie de troca é apagado de verdade depois de salvar", async () => {
    await pedirCodigo(TEL);
    await verificarCodigo(TEL, codigoRecebidoPelaMi());
    await salvarNovaSenha("senhaNova123");
    expect(H.cookies.has("mi_recuperacao")).toBe(false);
    // ...e sem cookie não dá para trocar a senha de novo.
    expect(await salvarNovaSenha("outraSenha123")).toMatchObject({ ok: false });
  });

  it("pedir um código novo invalida o anterior", async () => {
    await pedirCodigo(TEL);
    const primeiro = codigoRecebidoPelaMi();
    avancar(2);
    await pedirCodigo(TEL);
    const segundo = codigoRecebidoPelaMi();
    expect(segundo).not.toBe(primeiro);

    expect((await verificarCodigo(TEL, primeiro)).ok).toBe(false);
    expect((await verificarCodigo(TEL, segundo)).ok).toBe(true);
  });

  it("na 5ª tentativa errada o código morre, com aviso de pedir outro", async () => {
    await pedirCodigo(TEL);
    const certo = codigoRecebidoPelaMi();
    const errado = certo === "000000" ? "111111" : "000000";

    for (let i = 1; i <= 4; i++) {
      const r = await verificarCodigo(TEL, errado);
      expect(r).toMatchObject({ ok: false });
      if (!r.ok) expect(r.pedirNovo).toBeFalsy();
    }
    const quinta = await verificarCodigo(TEL, errado);
    expect(quinta).toMatchObject({ ok: false, pedirNovo: true });
    // Queimado: nem o código certo entra mais.
    expect((await verificarCodigo(TEL, certo)).ok).toBe(false);
  });
});

describe("B4 — limites de pedido", () => {
  it("cooldown de 60s: pedido repetido não gera código novo", async () => {
    await pedirCodigo(TEL);
    await pedirCodigo(TEL);
    expect(H.recoveries).toHaveLength(1);
    avancar(2);
    await pedirCodigo(TEL);
    expect(H.recoveries).toHaveLength(2);
  });

  it("teto de 3 pedidos por hora no mesmo cadastro", async () => {
    for (let i = 0; i < 6; i++) {
      await pedirCodigo(TEL);
      avancar(5);
    }
    expect(H.recoveries).toHaveLength(MAX_PEDIDOS_HORA);
  });
});

describe("B2 — o painel usa exatamente o mesmo caminho", () => {
  it("a Mi pede pelo e-mail e o código chega no WhatsApp dela", async () => {
    await pedirCodigo("MI@Miozorio.com.BR");
    expect(H.enviados).toHaveLength(1);
    expect(H.enviados[0]!.texto).toContain("acesso ao painel");
    expect(H.recoveries[0]!.perfil).toBe("admin");
  });

  it("mesmo ciclo: verificar não consome, salvar consome e derruba sessões", async () => {
    await pedirCodigo("mi@miozorio.com.br");
    const codigo = codigoRecebidoPelaMi();
    avancar(35);
    expect((await verificarCodigo("mi@miozorio.com.br", codigo)).ok).toBe(true);
    avancar(10);

    const r = await salvarNovaSenha("SenhaForteDoPainel!2026");
    expect(r).toMatchObject({
      ok: true,
      perfil: "admin",
      email: "mi@miozorio.com.br",
    });
    const a = H.admins[0]!;
    expect(
      bcrypt.compareSync("SenhaForteDoPainel!2026", String(a.passwordHash)),
    ).toBe(true);
    expect(a.tokenVersion).toBe(8); // era 7 → todos os JWTs antigos caem
  });

  it("senha do painel tem régua mais dura que a da cliente", async () => {
    await pedirCodigo("mi@miozorio.com.br");
    await verificarCodigo("mi@miozorio.com.br", codigoRecebidoPelaMi());
    expect(await salvarNovaSenha("curta1")).toMatchObject({ ok: false });
    expect(await salvarNovaSenha("123456789012")).toMatchObject({ ok: false });
    expect(await salvarNovaSenha("SenhaForteDoPainel!2026")).toMatchObject({
      ok: true,
    });
  });
});

describe("B2 — a Mi gera o código pela ficha da cliente", () => {
  it("devolve código, prazo e link pronto, sem mandar WhatsApp para ela mesma", async () => {
    const r = await gerarCodigoParaCliente(CLIENTE_ID);
    expect(r).not.toBeNull();
    expect(r!.codigo).toMatch(/^\d{6}$/);
    expect(r!.ate).toBe("14:30");
    expect(r!.telefoneVisivel).toBe("(21) 99862-6845");
    expect(r!.link).toContain("wa.me/5521998626845");
    expect(decodeURIComponent(r!.link)).toContain(r!.codigo);
    expect(H.enviados).toHaveLength(0); // ela está vendo na tela
    expect(H.recoveries[0]!.origem).toBe("admin");
    expect(H.recoveries[0]!.notifiedAt).toBeInstanceOf(Date);
  });

  it("o código gerado no painel vale no site (mesma tabela, mesmo módulo)", async () => {
    const r = await gerarCodigoParaCliente(CLIENTE_ID);
    expect((await verificarCodigo(TEL, r!.codigo)).ok).toBe(true);
    expect(await salvarNovaSenha("senhaNova123")).toMatchObject({ ok: true });
  });

  it("cliente fora do Clube não gera código", async () => {
    H.customers[0]!.clubJoinedAt = null;
    expect(await gerarCodigoParaCliente(CLIENTE_ID)).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("Revisão pré-deploy (15/09) — corridas e vazamentos no ciclo do código", () => {
  /** Um código errado com certeza: diferente do que a Mi recebeu. */
  const errado = (certo: string) => (certo === "000000" ? "000001" : "000000");

  it("5 palpites errados em PARALELO custam 5 tentativas, não 1 (teto atômico)", async () => {
    // Antes: read-modify-write — todos liam attempts=0 e gravavam 1.
    await pedirCodigo(TEL);
    const certo = codigoRecebidoPelaMi();
    await Promise.all(
      Array.from({ length: 5 }, () => verificarCodigo(TEL, errado(certo))),
    );
    expect(H.recoveries[0]!.attempts).toBe(5);
    expect(H.recoveries[0]!.usedAt).toBeInstanceOf(Date); // queimou
    // E nem o código certo vale mais: o teto foi respeitado.
    expect((await verificarCodigo(TEL, certo)).ok).toBe(false);
  });

  it("palpite errado nunca ressuscita um código já consumido", async () => {
    await pedirCodigo(TEL);
    const certo = codigoRecebidoPelaMi();
    await verificarCodigo(TEL, certo);
    // Salvar (consome) e um palpite errado em voo, ao mesmo tempo.
    await Promise.all([
      salvarNovaSenha("senhaNova123"),
      verificarCodigo(TEL, errado(certo)),
    ]);
    expect(H.recoveries[0]!.usedAt).toBeInstanceOf(Date);
    // Quem ainda tiver o código (ele fica no WhatsApp) não consegue nada.
    expect((await verificarCodigo(TEL, certo)).ok).toBe(false);
  });

  it("pedir código novo NÃO derruba uma confirmação em andamento", async () => {
    await pedirCodigo(TEL);
    await verificarCodigo(TEL, codigoRecebidoPelaMi()); // token de troca vivo
    avancar(2); // fora do cooldown de 60s
    await pedirCodigo(TEL); // terceiro — ou a própria cliente em outra aba
    // A tela da senha continua funcionando para quem confirmou.
    expect(await salvarNovaSenha("senhaNova123")).toMatchObject({ ok: true });
  });

  it("confirmação invalidada por OUTRO salvar: recusa sem hora do futuro", async () => {
    // Navegador A confirma o código e para na tela da senha.
    await pedirCodigo(TEL);
    await verificarCodigo(TEL, codigoRecebidoPelaMi());
    const cookieA = H.cookies.get("mi_recuperacao")!;
    // Navegador B pede outro código, confirma e salva — consome tudo.
    avancar(2);
    await pedirCodigo(TEL);
    await verificarCodigo(TEL, codigoRecebidoPelaMi());
    expect(await salvarNovaSenha("senhaDoB12345")).toMatchObject({ ok: true });
    // A tenta salvar com o token dele: recusado — e SEM "venceu às 13:47"
    // num relógio que marca 13:34.
    H.cookies.set("mi_recuperacao", cookieA);
    const r = await salvarNovaSenha("senhaDoA12345");
    expect(r).toMatchObject({ ok: false, pedirNovo: true });
    if (!r.ok) {
      expect(r.message).not.toMatch(/venceu às/);
      expect(r.message).toContain("Peça um código novo");
    }
  });

  it("passo 2 não conta o que o passo 1 esconde: desconhecido = 'sem código ativo'", async () => {
    const desconhecido = await verificarCodigo("(21) 90000-0000", "123456");
    const semCodigo = await verificarCodigo(TEL, "123456"); // cadastrada, sem pedido
    expect(desconhecido).toEqual(semCodigo);
    expect(desconhecido).toMatchObject({ ok: false, pedirNovo: true });
  });

  it("a forma FORMATADA do telefone também é recusada como senha", async () => {
    await pedirCodigo(TEL);
    await verificarCodigo(TEL, codigoRecebidoPelaMi());
    expect(await salvarNovaSenha("(21) 99862-6845")).toMatchObject({
      ok: false,
    });
    expect(await salvarNovaSenha("+55 21 99862-6845")).toMatchObject({
      ok: false,
    });
    // E uma senha de verdade continua passando.
    expect(await salvarNovaSenha("senhaNova123")).toMatchObject({ ok: true });
  });
});
