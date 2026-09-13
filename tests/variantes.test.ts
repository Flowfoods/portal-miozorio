import { describe, it, expect } from "vitest";
import {
  precoEfetivo,
  duracaoEfetiva,
  exigeTamanho,
  variantesVisiveis,
  aguardandoValidacaoTamanho,
  rotuloTamanho,
  type VarianteBase,
  type ServicoBase,
} from "@/lib/variantes";

const escova: ServicoBase = {
  priceCents: 8000,
  priceHomeCents: 10000,
  durationMin: 45,
};

const curto: VarianteBase = {
  id: "v1",
  nome: "cabelo curto",
  priceCents: 6000,
  priceHomeCents: 8000,
  durationMin: null, // herda os 45 min do serviço
  active: true,
};

const longo: VarianteBase = {
  id: "v2",
  nome: "cabelo longo",
  priceCents: 12000,
  priceHomeCents: null, // sem preço próprio de domicílio
  durationMin: 90,
  active: true,
};

describe("A3 — serviço SEM variação não muda em nada", () => {
  it("preço continua o do serviço", () => {
    expect(precoEfetivo(escova, null, "studio")).toBe(8000);
    expect(precoEfetivo(escova, null, "home")).toBe(10000);
  });

  it("duração continua a do serviço", () => {
    expect(duracaoEfetiva(escova, null)).toBe(45);
  });

  it("sem variação ativa, não exige tamanho", () => {
    expect(exigeTamanho([])).toBe(false);
    expect(exigeTamanho([{ active: false }])).toBe(false);
  });
});

describe("A3 — preço por tamanho", () => {
  it("a variação manda no preço do estúdio", () => {
    expect(precoEfetivo(escova, curto, "studio")).toBe(6000);
    expect(precoEfetivo(escova, longo, "studio")).toBe(12000);
  });

  it("domicílio usa o preço próprio da variação quando existe", () => {
    expect(precoEfetivo(escova, curto, "home")).toBe(8000);
  });

  it("variação sem preço de domicílio cai no preço dela de estúdio, não no do serviço", () => {
    // O erro fácil aqui seria voltar para priceHomeCents do SERVIÇO (10000) e
    // cobrar o valor de um tamanho que a cliente não escolheu.
    expect(precoEfetivo(escova, longo, "home")).toBe(12000);
  });
});

describe("A3 — duração por tamanho", () => {
  it("variação sem duração própria herda a do serviço", () => {
    expect(duracaoEfetiva(escova, curto)).toBe(45);
  });

  it("cabelo longo pode demorar mais e a agenda acompanha", () => {
    expect(duracaoEfetiva(escova, longo)).toBe(90);
  });
});

describe("A3 — quais tamanhos a cliente vê", () => {
  it("só os ativos, na ordem que a Mi cadastrou", () => {
    const lista = [
      { id: "c", active: true, sort: 2 },
      { id: "a", active: true, sort: 0 },
      { id: "x", active: false, sort: 1 },
      { id: "b", active: true, sort: 1 },
    ];
    expect(variantesVisiveis(lista).map((v) => v.id)).toEqual(["a", "b", "c"]);
  });

  it("desativar um tamanho não o apaga do histórico — só some da escolha", () => {
    expect(variantesVisiveis([{ active: false, sort: 0 }])).toHaveLength(0);
  });
});

describe("A3 — aguardando validação é DERIVADO, não um status", () => {
  // Um BookingStatus novo cairia fora do WHERE da constraint no_overlap e o
  // horário deixaria de ser protegido contra double-booking (R2).
  it("com tamanho escolhido e sem aprovação: aguardando", () => {
    expect(
      aguardandoValidacaoTamanho({ variantId: "v1", sizeApprovedAt: null }),
    ).toBe(true);
  });

  it("depois que a Mi aprova: não aguarda mais", () => {
    expect(
      aguardandoValidacaoTamanho({
        variantId: "v1",
        sizeApprovedAt: new Date(),
      }),
    ).toBe(false);
  });

  it("serviço sem tamanho nunca aguarda", () => {
    expect(
      aguardandoValidacaoTamanho({ variantId: null, sizeApprovedAt: null }),
    ).toBe(false);
  });

  it("rótulo sem jargão (R13) e null quando não se aplica", () => {
    expect(rotuloTamanho({ variantId: null, sizeApprovedAt: null })).toBeNull();
    expect(rotuloTamanho({ variantId: "v1", sizeApprovedAt: null })).toContain(
      "conferir",
    );
    expect(
      rotuloTamanho({ variantId: "v1", sizeApprovedAt: new Date() }),
    ).toContain("conferido");
  });
});
