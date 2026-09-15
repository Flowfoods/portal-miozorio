import { describe, it, expect, beforeEach, vi } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

/**
 * Posse nas rotas públicas de uma reserva — o IDOR que o `/confirm` fechou e a
 * vizinhança não tinha fechado.
 *
 * `POST /api/bookings/:id/sinal` gera cobrança PIX e não checava dono: com o
 * gateway ligado (R22), quem tivesse o UUID abria um PIX na reserva de outra
 * pessoa. O `GET` da mesma rota nem gateway exigia — respondia `pago` e
 * `confirmado` de qualquer reserva para quem perguntasse.
 *
 * Aqui travamos as três camadas: a DECISÃO (pura), a GUARDA (cookie + sessão +
 * banco, na ordem certa) e a COBERTURA (nenhuma rota sob `[id]` sem guarda).
 */

const H = vi.hoisted(() => ({
  cookies: new Map<string, string>(),
  sessao: null as { customerId: string; prov: boolean; tv: number } | null,
  reservas: new Map<string, { customerId: string }>(),
  consultas: 0,
}));

vi.mock("next/headers", () => ({
  cookies: () => ({
    get: (n: string) =>
      H.cookies.has(n) ? { name: n, value: H.cookies.get(n)! } : undefined,
  }),
}));

vi.mock("@/lib/cliente-auth", () => ({
  getClienteSession: async () => H.sessao,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    booking: {
      findUnique: async ({ where }: { where: { id: string } }) => {
        H.consultas++;
        return H.reservas.get(where.id) ?? null;
      },
    },
  },
}));

import {
  assinarPosse,
  nomeCookiePosse,
  sessaoEDona,
} from "@/lib/posse-reserva";
import { temPosseDaReserva } from "@/lib/posse-reserva-guarda";

const RESERVA = "6a1f3c2e-0b5d-4e77-9a11-2b3c4d5e6f70";
const OUTRA = "11112222-3333-4444-5555-666677778888";
const DONA = "aaaa1111-2222-3333-4444-555566667777";
const ESTRANHA = "bbbb1111-2222-3333-4444-555566667777";

/** Comprovante válido desta reserva, no cookie com o nome que a guarda lê. */
function comComprovante(id: string): void {
  H.cookies.set(
    nomeCookiePosse(id),
    assinarPosse(id, new Date(Date.now() + 8 * 60_000)),
  );
}

beforeEach(() => {
  process.env.NEXTAUTH_SECRET = "segredo-de-teste-para-o-hmac-do-cookie";
  H.cookies.clear();
  H.reservas.clear();
  H.sessao = null;
  H.consultas = 0;
  H.reservas.set(RESERVA, { customerId: DONA });
});

describe("sessaoEDona — a segunda porta, decidida sozinha", () => {
  it("a dona logada com senha própria entra", () => {
    expect(sessaoEDona({ customerId: DONA, prov: false }, DONA)).toBe(true);
  });

  it("sessão provisória NÃO entra, mesmo sendo da dona", () => {
    // 1º acesso: a senha ainda é o próprio telefone. Quem conhece o número
    // entraria na reserva — e esta é a porta que existe para PROVAR posse.
    expect(sessaoEDona({ customerId: DONA, prov: true }, DONA)).toBe(false);
  });

  it("quem está logada mas não é dona não entra", () => {
    expect(sessaoEDona({ customerId: ESTRANHA, prov: false }, DONA)).toBe(
      false,
    );
  });

  it("sem sessão não entra", () => {
    expect(sessaoEDona(null, DONA)).toBe(false);
  });

  it("reserva sem dono não dá posse a ninguém", () => {
    // Reserva que não existe chega como dono nulo. Sem esta guarda, um dia em
    // que o `select` devolvesse nulo daria a reserva a qualquer pessoa logada.
    expect(sessaoEDona({ customerId: DONA, prov: false }, null)).toBe(false);
    expect(sessaoEDona({ customerId: DONA, prov: false }, undefined)).toBe(
      false,
    );
  });
});

describe("temPosseDaReserva — o comprovante", () => {
  it("quem criou a reserva tem posse", async () => {
    comComprovante(RESERVA);
    await expect(temPosseDaReserva(RESERVA)).resolves.toBe(true);
  });

  it("o comprovante de uma reserva não abre outra", async () => {
    comComprovante(OUTRA);
    await expect(temPosseDaReserva(RESERVA)).resolves.toBe(false);
  });

  it("sem comprovante e sem sessão, não tem posse", async () => {
    await expect(temPosseDaReserva(RESERVA)).resolves.toBe(false);
  });

  it("o comprovante resolve sem consultar o banco", async () => {
    // Não é micro-otimização: é o que mantém o 403 independente de a reserva
    // existir. Consulta a mais aqui é o começo de um oráculo de UUID.
    comComprovante(RESERVA);
    await temPosseDaReserva(RESERVA);
    expect(H.consultas).toBe(0);
  });
});

describe("temPosseDaReserva — a segunda porta, ponta a ponta", () => {
  it("a dona logada confirma de outro aparelho (sem cookie)", async () => {
    H.sessao = { customerId: DONA, prov: false, tv: 1 };
    await expect(temPosseDaReserva(RESERVA)).resolves.toBe(true);
  });

  it("logada, mas a reserva é de outra pessoa", async () => {
    H.sessao = { customerId: ESTRANHA, prov: false, tv: 1 };
    await expect(temPosseDaReserva(RESERVA)).resolves.toBe(false);
  });

  it("sessão provisória não passa nem sendo da dona", async () => {
    H.sessao = { customerId: DONA, prov: true, tv: 1 };
    await expect(temPosseDaReserva(RESERVA)).resolves.toBe(false);
  });

  it("reserva inexistente não vira posse de ninguém", async () => {
    H.sessao = { customerId: DONA, prov: false, tv: 1 };
    await expect(temPosseDaReserva(OUTRA)).resolves.toBe(false);
  });
});

describe("temPosseDaReserva — configuração quebrada não vira 500", () => {
  /**
   * Um comprovante que CHEGA à conferência da assinatura. Token malformado não
   * serve aqui: `verificarPosse` o recusa no parse e nunca pede o segredo — foi
   * o que a primeira versão deste teste não viu.
   */
  const BEM_FORMADO = `${Date.now() + 10 * 60_000}.assinatura-que-nao-sera-conferida`;

  it("sem NEXTAUTH_SECRET, recusa em vez de explodir", async () => {
    const erro = vi.spyOn(console, "error").mockImplementation(() => {});
    delete process.env.NEXTAUTH_SECRET;
    H.cookies.set(nomeCookiePosse(RESERVA), BEM_FORMADO);

    // Vira "não é dona" (403, que tem caminho de saída pela Mi) e não 500 em
    // cima de uma reserva que está de pé.
    await expect(temPosseDaReserva(RESERVA)).resolves.toBe(false);
    expect(erro).toHaveBeenCalled();
    erro.mockRestore();
  });

  it("sem segredo, a cliente logada ainda entra pela segunda porta", async () => {
    const erro = vi.spyOn(console, "error").mockImplementation(() => {});
    delete process.env.NEXTAUTH_SECRET;
    H.cookies.set(nomeCookiePosse(RESERVA), BEM_FORMADO);
    H.sessao = { customerId: DONA, prov: false, tv: 1 };

    await expect(temPosseDaReserva(RESERVA)).resolves.toBe(true);
    erro.mockRestore();
  });
});

describe("cobertura — nenhuma rota de reserva sem guarda de posse", () => {
  const RAIZ = join(process.cwd(), "src/app/api/bookings/[id]");

  function rotas(dir: string): string[] {
    return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
      const p = join(dir, e.name);
      if (e.isDirectory()) return rotas(p);
      return e.name === "route.ts" ? [p] : [];
    });
  }

  /** Tira `/* *\/` e `// …` (poupa o `//` de URLs, que vem depois de `:`). */
  function semComentarios(s: string): string {
    return s
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/(^|[^:])\/\/.*$/gm, "$1");
  }

  /**
   * Toda forma de exportar um handler COM corpo que o Next aceita. A primeira
   * versão desta varredura só via `export async function` — `export const GET =`
   * e `export function GET` passariam por ela sem guarda nenhuma.
   */
  const ABRE_HANDLER =
    /export\s+(?:async\s+)?function\s+(GET|POST|PATCH|PUT|DELETE)\b|export\s+(?:const|let)\s+(GET|POST|PATCH|PUT|DELETE)\s*=/;

  function inicioDosHandlers(src: string): { pos: number; metodo: string }[] {
    const re = new RegExp(ABRE_HANDLER.source, "g");
    const achados: { pos: number; metodo: string }[] = [];
    let m: RegExpExecArray | null;
    while ((m = re.exec(src)) !== null)
      achados.push({ pos: m.index, metodo: m[1] ?? m[2] ?? "?" });
    return achados;
  }

  /**
   * Uma CHAMADA da guarda. A declaração `async function recusaSemPosse(` fica
   * fora do corpo de qualquer handler hoje, mas se um dia alguém a mover para
   * entre dois handlers ela seria atribuída ao anterior — o lookbehind impede
   * que a definição conte como uso.
   */
  const CHAMA_GUARDA =
    /(?<!function\s)\b(?:temPosseDaReserva|recusaSemPosse)\s*\(/;

  it("toda rota sob /api/bookings/[id] exige posse", () => {
    const achadas = rotas(RAIZ);
    // Se este número cair, alguém apagou uma rota; se subir, alguém criou uma
    // e este teste é o lembrete de que ela nasce pública.
    expect(achadas.length).toBeGreaterThanOrEqual(3);

    for (const arquivo of achadas) {
      // Sem comentários, senão `// temPosseDaReserva` satisfaz — o crítico de
      // completude provou isso com uma rota falsa que passou aqui.
      const src = semComentarios(readFileSync(arquivo, "utf8"));
      expect(
        CHAMA_GUARDA.test(src),
        `${arquivo} não chama temPosseDaReserva — rota de reserva nasce pública`,
      ).toBe(true);
    }
  });

  it("CADA handler exportado guarda o próprio corpo", () => {
    // Arquivo com dois handlers passaria no teste acima com a guarda em só um
    // deles — que é exatamente como o `GET` do `/sinal` ficou aberto enquanto o
    // `POST` do lado tinha dono. Aqui cada corpo é olhado sozinho.
    let olhados = 0;

    for (const arquivo of rotas(RAIZ)) {
      // Comentário citando a guarda não é guarda: a varredura olha só código.
      const src = semComentarios(readFileSync(arquivo, "utf8"));

      // `export { h as GET }` e `export { GET }` não têm corpo para fatiar —
      // `ABRE_HANDLER` só vê `export` colado à declaração. O repo usa a forma
      // com `as` (NextAuth), então ela é real; a sem `as` escapou da primeira
      // versão deste regex, que exigia o `as`. Sob [id] as duas são recusadas
      // de frente, com instrução, em vez de passar em silêncio.
      const reexport =
        /export\s*\{[^}]*\b(GET|POST|PATCH|PUT|DELETE)\b[^}]*\}/.exec(src);
      expect(
        reexport,
        `${arquivo}: "${reexport?.[0]}" — a varredura não enxerga re-export; escreva o handler como export async function`,
      ).toBeNull();

      const inicios = inicioDosHandlers(src);
      for (let i = 0; i < inicios.length; i++) {
        const atual = inicios[i];
        if (!atual) continue;
        const corpo = src.slice(atual.pos, inicios[i + 1]?.pos ?? src.length);
        olhados++;
        expect(
          CHAMA_GUARDA.test(corpo),
          `${arquivo}: o ${atual.metodo} não guarda o próprio corpo`,
        ).toBe(true);
      }
    }

    // Sem isto, um regex que parasse de casar tornaria o laço vazio e o teste
    // passaria sem ter olhado nada.
    expect(olhados).toBeGreaterThanOrEqual(4);
  });
});
