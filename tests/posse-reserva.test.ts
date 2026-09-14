import { describe, it, expect, beforeEach } from "vitest";
import {
  FOLGA_POSSE_MS,
  assinarPosse,
  nomeCookiePosse,
  validadeDaPosse,
  verificarPosse,
} from "@/lib/posse-reserva";

/**
 * Posse da reserva — quem criou é quem confirma.
 *
 * A rota `/api/bookings/:id/confirm` é pública: até aqui, qualquer POST com um
 * id de reserva pendente confirmava a reserva de outra pessoa. Estes testes
 * travam as três propriedades que sustentam o conserto: o comprovante vale só
 * para AQUELA reserva, só até AQUELE prazo, e só com O segredo do portal.
 */

const RESERVA = "6a1f3c2e-0b5d-4e77-9a11-2b3c4d5e6f70";
const OUTRA = "11112222-3333-4444-5555-666677778888";

beforeEach(() => {
  process.env.NEXTAUTH_SECRET = "segredo-de-teste-para-o-hmac-do-cookie";
});

describe("nomeCookiePosse — um cookie por reserva", () => {
  it("nomes diferentes para reservas diferentes", () => {
    // Um cookie único guardaria só a última reserva, e a cliente pode ter duas
    // em aberto (MAX_PENDING_POR_TELEFONE): confirmar a primeira passaria a
    // falhar sozinha.
    expect(nomeCookiePosse(RESERVA)).not.toBe(nomeCookiePosse(OUTRA));
    expect(nomeCookiePosse(RESERVA)).toContain(RESERVA);
  });
});

describe("assinarPosse / verificarPosse", () => {
  it("o comprovante recém-emitido confirma a própria reserva", () => {
    const t = assinarPosse(RESERVA, new Date(Date.now() + 8 * 60_000));
    expect(verificarPosse(t, RESERVA)).toBe(true);
  });

  it("comprovante de uma reserva NÃO confirma outra", () => {
    const t = assinarPosse(RESERVA, new Date(Date.now() + 8 * 60_000));
    expect(verificarPosse(t, OUTRA)).toBe(false);
  });

  it("vencido não vale", () => {
    const agora = new Date("2026-09-14T12:00:00Z");
    const t = assinarPosse(RESERVA, new Date(agora.getTime() + 60_000));
    expect(verificarPosse(t, RESERVA, new Date(agora.getTime() + 30_000))).toBe(
      true,
    );
    expect(verificarPosse(t, RESERVA, new Date(agora.getTime() + 61_000))).toBe(
      false,
    );
  });

  it("esticar o prazo no cookie invalida a assinatura", () => {
    // O ataque óbvio: o comprovante carrega a validade em texto claro. Ela é
    // parte do que o HMAC cobre, então mexer nela quebra a conferência.
    const validade = Date.now() + 60_000;
    const t = assinarPosse(RESERVA, new Date(validade));
    const assinatura = t.split(".")[1];
    const esticado = `${validade + 86_400_000}.${assinatura}`;
    expect(verificarPosse(esticado, RESERVA)).toBe(false);
  });

  it("assinatura adulterada não vale", () => {
    const t = assinarPosse(RESERVA, new Date(Date.now() + 60_000));
    const [exp, sig] = t.split(".");
    const trocado = sig!.startsWith("A")
      ? `B${sig!.slice(1)}`
      : `A${sig!.slice(1)}`;
    expect(verificarPosse(`${exp}.${trocado}`, RESERVA)).toBe(false);
  });

  it("outro segredo não valida — girar NEXTAUTH_SECRET derruba os comprovantes", () => {
    const t = assinarPosse(RESERVA, new Date(Date.now() + 60_000));
    process.env.NEXTAUTH_SECRET = "outro-segredo-qualquer";
    expect(verificarPosse(t, RESERVA)).toBe(false);
  });

  it("entrada lixo devolve false em vez de explodir", () => {
    // timingSafeEqual LANÇA com tamanhos diferentes: sem a guarda de tamanho um
    // cookie truncado viraria 500 no lugar de 403.
    for (const lixo of [
      undefined,
      null,
      "",
      ".",
      "sem-ponto",
      "123.",
      ".assinatura",
      "abc.def",
      "1e999.xxx",
      `${Date.now() + 60_000}.curta`,
    ]) {
      expect(verificarPosse(lixo, RESERVA)).toBe(false);
    }
  });

  it("não carrega quem é a cliente — só prazo e assinatura", () => {
    // O comprovante não é sessão: vazá-lo não conta nada sobre a pessoa nem
    // abre nenhuma outra porta.
    const t = assinarPosse(RESERVA, new Date(Date.now() + 60_000));
    expect(t).not.toContain(RESERVA);
    expect(t.split(".")).toHaveLength(2);
  });
});

describe("validadeDaPosse — folga sobre o horário guardado", () => {
  it("vence depois do hold, para o 410 chegar antes do 403", () => {
    // Quem chega atrasado precisa ler "o tempo da reserva expirou", que explica
    // o que houve, e não "não consegui confirmar por aqui", que é a resposta
    // para quem não é dono.
    const hold = new Date("2026-09-14T12:08:00Z");
    expect(validadeDaPosse(hold.toISOString()).getTime()).toBe(
      hold.getTime() + FOLGA_POSSE_MS,
    );
    expect(validadeDaPosse(hold).getTime()).toBe(
      hold.getTime() + FOLGA_POSSE_MS,
    );
  });

  it("hold ausente ou ilegível ainda gera um prazo válido", () => {
    const antes = Date.now();
    for (const entrada of [null, "", "nem-data"]) {
      const v = validadeDaPosse(entrada).getTime();
      expect(v).toBeGreaterThanOrEqual(antes + FOLGA_POSSE_MS);
    }
  });
});
