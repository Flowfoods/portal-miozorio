import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  MAX_POSSES,
  emitirPosse,
  empilharPosse,
  posseAtiva,
  temPosse,
} from "../src/lib/posse-booking";

/**
 * Posse da reserva — quem pode chamar `POST /api/bookings/:id/confirm`.
 *
 * Antes, ninguém checava: bastava ter o UUID. Estes testes travam as duas
 * metades da decisão — a proteção em si, e a escolha DELIBERADA de falhar
 * aberto quando não há segredo, que é o oposto do webhook de pagamento.
 */

const RESERVA = "11111111-2222-3333-4444-555555555555";
const OUTRA = "99999999-8888-7777-6666-555555555555";
const AGORA = 1_800_000_000_000;
const DAQUI_1H = AGORA + 3_600_000;

const segredoOriginal = process.env.NEXTAUTH_SECRET;
beforeEach(() => {
  process.env.NEXTAUTH_SECRET = "segredo-de-teste";
});
afterEach(() => {
  if (segredoOriginal === undefined) delete process.env.NEXTAUTH_SECRET;
  else process.env.NEXTAUTH_SECRET = segredoOriginal;
});

describe("emitir e verificar", () => {
  it("o comprovante da própria reserva vale", () => {
    const t = emitirPosse(RESERVA, DAQUI_1H)!;
    expect(temPosse(t, RESERVA, AGORA)).toBe(true);
  });

  it("comprovante de OUTRA reserva não serve", () => {
    const t = emitirPosse(OUTRA, DAQUI_1H)!;
    expect(temPosse(t, RESERVA, AGORA)).toBe(false);
  });

  it("sem cookie, não há posse", () => {
    expect(temPosse(null, RESERVA, AGORA)).toBe(false);
    expect(temPosse("", RESERVA, AGORA)).toBe(false);
  });

  it("comprovante vencido não vale", () => {
    const t = emitirPosse(RESERVA, AGORA - 1)!;
    expect(temPosse(t, RESERVA, AGORA)).toBe(false);
  });

  it("assinatura adulterada não vale", () => {
    const t = emitirPosse(RESERVA, DAQUI_1H)!;
    const [id, exp] = t.split(".");
    expect(temPosse(`${id}.${exp}.assinaturaFalsa`, RESERVA, AGORA)).toBe(false);
  });

  it("esticar a validade invalida a assinatura", () => {
    // A expiração está DENTRO do que é assinado — mexer nela quebra o HMAC.
    // Se estivesse fora, qualquer um estenderia a posse editando o cookie.
    const t = emitirPosse(RESERVA, AGORA + 1000)!;
    const [id, , sig] = t.split(".");
    const esticado = `${id}.${AGORA + 999_999}.${sig}`;
    expect(temPosse(esticado, RESERVA, AGORA)).toBe(false);
  });

  it("comprovante assinado com outro segredo não vale", () => {
    const t = emitirPosse(RESERVA, DAQUI_1H)!;
    process.env.NEXTAUTH_SECRET = "outro-segredo";
    expect(temPosse(t, RESERVA, AGORA)).toBe(false);
  });

  it("lixo no cookie não derruba a verificação", () => {
    const t = emitirPosse(RESERVA, DAQUI_1H)!;
    expect(temPosse(`nada~~${t}~tambem.nao`, RESERVA, AGORA)).toBe(true);
    expect(temPosse("....~a.b.c~", RESERVA, AGORA)).toBe(false);
  });
});

describe("empilhar — agendar de novo não pode apagar a posse anterior", () => {
  it("guarda as duas reservas", () => {
    const a = emitirPosse(RESERVA, DAQUI_1H)!;
    const b = emitirPosse(OUTRA, DAQUI_1H)!;
    const cookie = empilharPosse(a, b);
    expect(temPosse(cookie, RESERVA, AGORA)).toBe(true);
    expect(temPosse(cookie, OUTRA, AGORA)).toBe(true);
  });

  it("reemitir a MESMA reserva não duplica", () => {
    const a1 = emitirPosse(RESERVA, DAQUI_1H)!;
    const a2 = emitirPosse(RESERVA, DAQUI_1H + 1000)!;
    const cookie = empilharPosse(a1, a2);
    expect(cookie.split("~")).toHaveLength(1);
    expect(temPosse(cookie, RESERVA, AGORA)).toBe(true);
  });

  it(`corta no teto de ${MAX_POSSES}, mantendo as mais novas`, () => {
    let cookie = "";
    const ids = Array.from({ length: MAX_POSSES + 3 }, (_, i) =>
      `${i}0000000-0000-0000-0000-000000000000`,
    );
    for (const id of ids) cookie = empilharPosse(cookie, emitirPosse(id, DAQUI_1H)!);

    expect(cookie.split("~")).toHaveLength(MAX_POSSES);
    // A mais recente sobrevive; a mais antiga cai (o cookie não cresce sem fim).
    expect(temPosse(cookie, ids[ids.length - 1]!, AGORA)).toBe(true);
    expect(temPosse(cookie, ids[0]!, AGORA)).toBe(false);
  });
});

describe("sem NEXTAUTH_SECRET — falha ABERTO, de propósito", () => {
  beforeEach(() => {
    delete process.env.NEXTAUTH_SECRET;
  });

  it("a verificação se desliga e o fluxo volta a ser o de antes", () => {
    // Escolha deliberada, e o oposto do webhook de pagamento (que falha
    // fechado). A assimetria do dano manda: webhook sem verificação deixa
    // qualquer um marcar uma reserva como PAGA; posse sem verificação deixa
    // alguém que adivinhou um UUID v4 confirmar uma reserva que a cliente já
    // queria confirmar, sem escapar do sinal nem do hold. Falhar fechado aqui
    // derrubaria TODAS as confirmações por causa de uma env ausente.
    expect(posseAtiva()).toBe(false);
    expect(emitirPosse(RESERVA, DAQUI_1H)).toBeNull();
    expect(temPosse(null, RESERVA, AGORA)).toBe(true);
  });
});
