/**
 * Parte PURA do sistema de mídia (BUG D): constantes e detecção de tipo por
 * magic bytes, sem nenhum import de Node — pode ser usada tanto no servidor
 * quanto em componentes "use client" (o pré-redimensionamento no navegador
 * precisa das mesmas regras do servidor, senão os limites divergem).
 */

export const MEDIA_CATEGORIES = [
  "hero",
  "sobre",
  "portfolio",
  "servico",
] as const;
export type MediaCategory = (typeof MEDIA_CATEGORIES)[number];

export const MEDIA_CATEGORY_LABEL: Record<MediaCategory, string> = {
  hero: "Topo do site",
  sobre: "Página Sobre",
  portfolio: "Portfólio",
  servico: "Serviços",
};

/**
 * Limite por foto ACEITO na entrada (BUG D — F4.2). Export de fotógrafo
 * profissional em resolução cheia tem 15–40MB; 12MB barrava justamente a foto
 * do topo do site. O peso real que trafega é bem menor: o navegador
 * pré-redimensiona para ≤4000px/q0.92 antes de enviar quando consegue.
 */
export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

/** Pré-redimensionamento no navegador (F4.2): teto alto de propósito —
 * comprimir demais no cliente destrói o que o pipeline do servidor preserva. */
export const CLIENT_MAX_DIM = 4000;
export const CLIENT_JPEG_QUALITY = 0.92;
/** Abaixo disso não vale a pena recomprimir no navegador. */
export const CLIENT_SKIP_BYTES = 4 * 1024 * 1024;

/** Tipos aceitos no upload de fotos do site (valida-se o CONTEÚDO, não a extensão). */
export type ImageKind = "jpeg" | "png" | "webp" | "heic";

export const UPLOAD_ACCEPT =
  "image/jpeg,image/png,image/webp,image/heic,image/heif";

/** Brands HEIF/HEIC do box `ftyp` (iPhone). AVIF fica de fora de propósito:
 * o sharp decodifica AVIF nativamente, HEIC (HEVC) não. */
const HEIC_BRANDS = new Set([
  "heic",
  "heix",
  "hevc",
  "hevx",
  "heim",
  "heis",
  "mif1",
  "msf1",
]);

/**
 * Detecta o tipo real da imagem pelos primeiros bytes. `null` = não é uma
 * imagem que aceitamos (ex.: PDF renomeado para .jpg).
 */
export function sniffImageKind(bytes: Uint8Array): ImageKind | null {
  if (bytes.length < 16) return null;
  // JPEG: FF D8 FF
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff)
    return "jpeg";
  // PNG: 89 'P' 'N' 'G'
  if (
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  )
    return "png";
  const ascii = (from: number, to: number) => {
    let s = "";
    for (let i = from; i < to; i++) s += String.fromCharCode(bytes[i] ?? 0);
    return s;
  };
  // WebP: "RIFF" .... "WEBP"
  if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return "webp";
  // HEIC/HEIF: box `ftyp` + brand conhecida
  if (ascii(4, 8) === "ftyp" && HEIC_BRANDS.has(ascii(8, 12))) return "heic";
  return null;
}

/** Extensão do arquivo ORIGINAL guardado (nunca serve para validar nada). */
export const KIND_EXT: Record<ImageKind, string> = {
  jpeg: "jpg",
  png: "png",
  webp: "webp",
  heic: "heic",
};

/** Formata bytes para a Mi ("18,4 MB") — mensagens de erro específicas. */
export function formatMB(bytes: number): string {
  return `${(bytes / 1024 / 1024).toFixed(1).replace(".", ",")} MB`;
}
