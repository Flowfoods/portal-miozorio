import { describe, it, expect } from "vitest";
import { sniffImageKind, formatMB } from "@/lib/media-shared";

/** Monta um buffer com os magic bytes pedidos + enchimento até 32 bytes. */
function bytes(...inicio: (number | string)[]): Uint8Array {
  const arr: number[] = [];
  for (const p of inicio) {
    if (typeof p === "string") for (const ch of p) arr.push(ch.charCodeAt(0));
    else arr.push(p);
  }
  while (arr.length < 32) arr.push(0);
  return new Uint8Array(arr);
}

describe("sniffImageKind · o CONTEÚDO decide, nunca a extensão", () => {
  it("reconhece JPEG", () => {
    expect(sniffImageKind(bytes(0xff, 0xd8, 0xff, 0xe0))).toBe("jpeg");
  });

  it("reconhece PNG", () => {
    expect(sniffImageKind(bytes(0x89, "PNG", 0x0d, 0x0a))).toBe("png");
  });

  it("reconhece WebP (RIFF + WEBP)", () => {
    expect(sniffImageKind(bytes("RIFF", 0, 0, 0, 0, "WEBP"))).toBe("webp");
  });

  it("reconhece HEIC de iPhone (ftyp + brand)", () => {
    expect(sniffImageKind(bytes(0, 0, 0, 0x18, "ftyp", "heic"))).toBe("heic");
    expect(sniffImageKind(bytes(0, 0, 0, 0x18, "ftyp", "mif1"))).toBe("heic");
  });

  it("recusa PDF renomeado para .jpg (cenário da matriz de QA)", () => {
    expect(sniffImageKind(bytes("%PDF-1.7"))).toBe(null);
  });

  it("recusa AVIF como HEIC (sharp decodifica AVIF sozinho)", () => {
    // brand "avif" não está na lista de HEIC → null aqui; quem valida decode
    // de verdade é o sharp no servidor.
    expect(sniffImageKind(bytes(0, 0, 0, 0x18, "ftyp", "avif"))).toBe(null);
  });

  it("recusa buffer curto ou lixo", () => {
    expect(sniffImageKind(new Uint8Array([1, 2, 3]))).toBe(null);
    expect(sniffImageKind(bytes("texto qualquer"))).toBe(null);
  });
});

describe("formatMB · mensagem específica, nunca 'erro ao enviar'", () => {
  it("formata com vírgula (pt-BR)", () => {
    expect(formatMB(12 * 1024 * 1024)).toBe("12,0 MB");
    expect(formatMB(18.4 * 1024 * 1024)).toBe("18,4 MB");
  });
});
