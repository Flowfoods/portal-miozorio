import { describe, expect, it } from "vitest";
import { isImagemValida, nomePublico } from "@/lib/momentos";

describe("momentos · isImagemValida (magic bytes)", () => {
  it("aceita JPEG (FF D8 FF)", () => {
    const buf = Buffer.concat([
      Buffer.from([0xff, 0xd8, 0xff, 0xe0]),
      Buffer.alloc(16),
    ]);
    expect(isImagemValida(buf)).toBe(true);
  });

  it("aceita PNG (89 50 4E 47)", () => {
    const buf = Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      Buffer.alloc(16),
    ]);
    expect(isImagemValida(buf)).toBe(true);
  });

  it("aceita WebP (RIFF....WEBP)", () => {
    const buf = Buffer.concat([
      Buffer.from("RIFF", "ascii"),
      Buffer.from([0x10, 0x00, 0x00, 0x00]),
      Buffer.from("WEBP", "ascii"),
      Buffer.alloc(16),
    ]);
    expect(isImagemValida(buf)).toBe(true);
  });

  it("rejeita PDF disfarçado de imagem", () => {
    const buf = Buffer.concat([
      Buffer.from("%PDF-1.4", "ascii"),
      Buffer.alloc(16),
    ]);
    expect(isImagemValida(buf)).toBe(false);
  });

  it("rejeita SVG/script (texto)", () => {
    expect(isImagemValida(Buffer.from("<svg onload=alert(1)>"))).toBe(false);
  });

  it("rejeita buffer minúsculo", () => {
    expect(isImagemValida(Buffer.from([0xff, 0xd8]))).toBe(false);
  });
});

describe("momentos · nomePublico", () => {
  it("primeiro nome + inicial do último sobrenome", () => {
    expect(nomePublico("Linda Souza")).toBe("Linda S.");
    expect(nomePublico("Maria da Silva Santos")).toBe("Maria S.");
  });

  it("nome único fica só o primeiro nome", () => {
    expect(nomePublico("Linda")).toBe("Linda");
  });

  it("normaliza espaços extras", () => {
    expect(nomePublico("  Ana   Clara  ")).toBe("Ana C.");
  });
});
