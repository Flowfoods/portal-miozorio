import { describe, it, expect } from "vitest";
import path from "node:path";
import { podeServirPublicamente } from "@/lib/media-path";

const mediaDir = "/app/media";
const privateDir = path.join(mediaDir, "priv");
const pode = (...segments: string[]) =>
  podeServirPublicamente({ mediaDir, privateDir, segments });

describe("media pública · fronteira com o store privado (LGPD)", () => {
  it("serve foto pública .webp", () => {
    expect(pode("portfolio-abc123.webp")).toBe(true);
  });

  it("NÃO serve o store privado (foto de referência da cliente)", () => {
    // Antes passava nas duas travas existentes (dentro do volume, extensão
    // .webp) e saía com Cache-Control imutável de um ano.
    expect(pode("priv", "abc123.webp")).toBe(false);
  });

  it("não se deixa enganar por caminho relativo até o privado", () => {
    expect(pode("portfolio", "..", "priv", "abc123.webp")).toBe(false);
    expect(pode(".", "priv", "abc123.webp")).toBe(false);
  });

  it("recusa path traversal para fora do volume", () => {
    expect(pode("..", "etc", "senha.webp")).toBe(false);
    expect(pode("..", "..", "..", "etc", "passwd.webp")).toBe(false);
    // Traversal que volta para dentro do volume é caminho legítimo depois de
    // normalizado — o que importa é onde o arquivo PARA, não como se escreveu.
    expect(pode("..", "media", "x.webp")).toBe(true);
  });

  it("recusa extensão que não geramos", () => {
    expect(pode("foto.jpg")).toBe(false);
    expect(pode("script.webp.js")).toBe(false);
    expect(pode("sem-extensao")).toBe(false);
  });

  it("recusa o próprio diretório privado", () => {
    expect(pode("priv")).toBe(false);
  });
});
