import { mkdir, unlink, writeFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import path from "node:path";
import sharp from "sharp";
import type { MediaAsset } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  KIND_EXT,
  MAX_UPLOAD_BYTES,
  MEDIA_CATEGORIES,
  sniffImageKind,
  type ImageKind,
  type MediaCategory,
} from "@/lib/media-shared";

/**
 * Sistema de mídia (M8.4, refeito no BUG D). Arquivos ficam fora do bundle,
 * em MEDIA_DIR (volume persistente `miozorio-media` montado em /app/media;
 * localmente ./media), e são servidos pela rota /media/[...path] com cache
 * imutável — o nome do arquivo é único por upload, então nunca muda.
 *
 * Layout do volume:
 *   <MEDIA_DIR>/<id>.webp   → master público (2000px, q90) — o que o site serve
 *   <MEDIA_DIR>/orig/…      → ORIGINAL intacto, como chegou (nunca servido:
 *                             guarda EXIF/GPS; existe para regerar derivados)
 *   <MEDIA_DIR>/priv/…      → fotos de referência de cliente + anexos (LGPD)
 */
export const MEDIA_DIR =
  process.env.MEDIA_DIR ?? path.join(process.cwd(), "media");

// Re-export: quem roda no servidor pode continuar importando daqui; código de
// cliente importa direto de media-shared (este módulo puxa sharp/fs).
export { MAX_UPLOAD_BYTES, MEDIA_CATEGORIES };
export type { MediaCategory };

/** Originais intactos — subdiretório NUNCA servido pela rota pública. */
export const ORIGINALS_DIR = path.join(MEDIA_DIR, "orig");

/**
 * Master público: 2000px cobre o hero em qualquer tela real (o next/image
 * gera os tamanhos menores a partir dele). q90 + smartSubsample preservam
 * transição de cor de pele/batom/sombra — 82 "genérico" borrava exatamente
 * o que vende o trabalho da Mi. Nunca upscale (withoutEnlargement).
 */
const MASTER_DIM = 2000;
const MASTER_QUALITY = 90;

export type ProcessedUpload = {
  /** Caminho público (/media/<arquivo>.webp). */
  url: string;
  /** Chave do original em orig/ (relativa a MEDIA_DIR). */
  origUrl: string;
  /** Dimensões do master — reserva proporção no site (zero layout shift). */
  width: number;
  height: number;
  /** Placeholder borrado (data URL) para placeholder="blur". */
  blurData: string;
};

/**
 * Decodifica o buffer para algo que o sharp lê. HEIC de iPhone não tem
 * decoder no sharp empacotado (patente do HEVC) — converte via heic-convert
 * (WASM, mais lento; aceitável no volume da Mi). Lança se não for imagem.
 */
async function toDecodable(
  input: Buffer,
): Promise<{ buf: Buffer; kind: ImageKind }> {
  const kind = sniffImageKind(input);
  if (!kind) throw new Error("Arquivo não é uma imagem aceita.");
  if (kind === "heic") {
    const { default: heicConvert } = await import("heic-convert");
    const jpeg = await heicConvert({
      buffer: input,
      format: "JPEG",
      quality: 0.95,
    });
    return { buf: Buffer.from(jpeg), kind };
  }
  return { buf: input, kind };
}

/**
 * Processa um upload do site: valida o CONTEÚDO (magic bytes), corrige a
 * rotação EXIF, guarda o ORIGINAL intacto em orig/ e gera o master público
 * WebP (2000px, q90, sem metadados — EXIF/GPS ficam só no original privado).
 */
export async function processUpload(input: Buffer): Promise<ProcessedUpload> {
  const { buf, kind } = await toDecodable(input);
  const base = `${Date.now().toString(36)}-${randomBytes(4).toString("hex")}`;

  const { data: master, info } = await sharp(buf)
    .rotate()
    .resize(MASTER_DIM, MASTER_DIM, { fit: "inside", withoutEnlargement: true })
    .webp({ quality: MASTER_QUALITY, smartSubsample: true, effort: 5 })
    .toBuffer({ resolveWithObject: true });

  const blur = await sharp(buf)
    .rotate()
    .resize(16, 16, { fit: "inside" })
    .webp({ quality: 40 })
    .toBuffer();

  const origName = `${base}.${KIND_EXT[kind]}`;
  await mkdir(ORIGINALS_DIR, { recursive: true });
  await writeFile(path.join(ORIGINALS_DIR, origName), input);
  await writeFile(path.join(MEDIA_DIR, `${base}.webp`), master);

  return {
    url: `/media/${base}.webp`,
    origUrl: `orig/${origName}`,
    width: info.width,
    height: info.height,
    blurData: `data:image/webp;base64,${blur.toString("base64")}`,
  };
}

/** Apaga o arquivo físico de um asset (best-effort — a linha do banco manda). */
export async function deleteMediaFile(url: string): Promise<void> {
  const name = path.basename(url); // ignora diretórios — só o arquivo
  await unlink(path.join(MEDIA_DIR, name)).catch(() => undefined);
}

/** Apaga o original correspondente (best-effort). */
export async function deleteOriginalFile(
  origUrl: string | null,
): Promise<void> {
  if (!origUrl) return;
  const name = path.basename(origUrl);
  await unlink(path.join(ORIGINALS_DIR, name)).catch(() => undefined);
}

// ── Fotos PRIVADAS (foto de referência da cliente — LGPD) ──────────────────
// Ficam num subdir `priv/` do volume; nunca servidas por /media (público).
// Acesso só pela rota autenticada /admin/media. Guardamos só a chave (nome).
export const PRIVATE_MEDIA_DIR = path.join(MEDIA_DIR, "priv");
/** Limite por foto de cliente (LGPD/feature 2): ~5MB antes da compressão. */
export const MAX_BOOKING_PHOTO_BYTES = 5 * 1024 * 1024;

/** Processa uma foto privada (WebP, 1600px) → devolve a chave (nome do arquivo).
 * Também aceita HEIC de iPhone (mesmo caminho de decodificação do upload público). */
export async function processPrivatePhoto(input: Buffer): Promise<string> {
  const { buf } = await toDecodable(input);
  const webp = await sharp(buf)
    .rotate()
    .resize(1600, 1600, { fit: "inside", withoutEnlargement: true })
    .webp({ quality: 82 })
    .toBuffer();
  const name = `${Date.now().toString(36)}-${randomBytes(6).toString("hex")}.webp`;
  await mkdir(PRIVATE_MEDIA_DIR, { recursive: true });
  await writeFile(path.join(PRIVATE_MEDIA_DIR, name), webp);
  return name;
}

/** Lê uma foto privada por chave (path traversal travado). null se não existir. */
export async function readPrivatePhoto(key: string): Promise<Buffer | null> {
  const name = path.basename(key); // só o arquivo, ignora diretórios
  if (!name.endsWith(".webp")) return null;
  const file = path.join(PRIVATE_MEDIA_DIR, name);
  try {
    const { readFile } = await import("node:fs/promises");
    return await readFile(file);
  } catch {
    return null;
  }
}

/** Apaga a foto privada (best-effort). */
export async function deletePrivatePhoto(key: string): Promise<void> {
  const name = path.basename(key);
  await unlink(path.join(PRIVATE_MEDIA_DIR, name)).catch(() => undefined);
}

// ── Anexos privados do Financeiro (comprovante/nota: PDF ou imagem) ──────────
// Mesmo store PRIVADO (priv/) + trava de traversal + rota autenticada do padrão
// de foto da cliente, generalizado: PDF entra como está (passthrough), imagem
// idem (não converte — legibilidade da nota importa). Guardamos só a chave.

/** Mime aceito → extensão do arquivo gravado. */
export const ATTACHMENT_MIME: Record<string, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

/** Extensão → Content-Type ao servir. */
const ATTACHMENT_CONTENT_TYPE: Record<string, string> = {
  pdf: "application/pdf",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

/** Limite por anexo (comprovante/nota). */
export const MAX_ATTACHMENT_BYTES = 12 * 1024 * 1024;

/** Grava um anexo privado (passthrough). Devolve a chave (nome do arquivo). */
export async function saveAttachmentFile(
  input: Buffer,
  mimeType: string,
): Promise<string> {
  const ext = ATTACHMENT_MIME[mimeType];
  if (!ext) throw new Error("Tipo de arquivo não suportado.");
  const name = `${Date.now().toString(36)}-${randomBytes(6).toString("hex")}.${ext}`;
  await mkdir(PRIVATE_MEDIA_DIR, { recursive: true });
  await writeFile(path.join(PRIVATE_MEDIA_DIR, name), input);
  return name;
}

/** Lê um anexo privado por chave (traversal travado). null se não existir/inválido. */
export async function readPrivateAttachment(
  key: string,
): Promise<{ buffer: Buffer; contentType: string } | null> {
  const name = path.basename(key);
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  const contentType = ATTACHMENT_CONTENT_TYPE[ext];
  if (!contentType) return null;
  try {
    const { readFile } = await import("node:fs/promises");
    const buffer = await readFile(path.join(PRIVATE_MEDIA_DIR, name));
    return { buffer, contentType };
  } catch {
    return null;
  }
}

/** Apaga um anexo privado (best-effort) — mesmo dir das fotos privadas. */
export const deletePrivateAttachment = deletePrivatePhoto;

/**
 * Fotos publicadas de uma categoria, na ordem do painel. Nunca lança: sem
 * banco (build local, prerender) devolve [] e o site cai no fallback elegante.
 */
export async function getPublishedMedia(
  category: MediaCategory,
  limit?: number,
): Promise<MediaAsset[]> {
  try {
    return await prisma.mediaAsset.findMany({
      where: { category, published: true },
      orderBy: [{ sort: "asc" }, { createdAt: "desc" }],
      ...(limit ? { take: limit } : {}),
    });
  } catch {
    return [];
  }
}
