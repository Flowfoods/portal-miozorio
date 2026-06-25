import { mkdir, unlink, writeFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import path from "node:path";
import sharp from "sharp";
import type { MediaAsset } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * Sistema de mídia (M8.4). Arquivos ficam fora do bundle, em MEDIA_DIR
 * (volume persistente no Dokploy montado em /app/media; localmente ./media),
 * e são servidos pela rota /media/[...path] com cache imutável — o nome do
 * arquivo é único por upload, então nunca muda de conteúdo.
 */
export const MEDIA_DIR =
  process.env.MEDIA_DIR ?? path.join(process.cwd(), "media");

export const MEDIA_CATEGORIES = [
  "hero",
  "sobre",
  "portfolio",
  "servico",
] as const;
export type MediaCategory = (typeof MEDIA_CATEGORIES)[number];

const MAX_DIM = 1600;
const WEBP_QUALITY = 82;
/** Limite por foto (antes da compressão) — celular comum gera 3–8MB. */
export const MAX_UPLOAD_BYTES = 12 * 1024 * 1024;

/**
 * Processa um upload: corrige rotação EXIF, limita a 1600px no maior lado e
 * converte para WebP. Retorna o nome do arquivo gravado em MEDIA_DIR.
 * Lança se o buffer não for uma imagem que o sharp entenda (ex.: HEIC).
 */
export async function processUpload(input: Buffer): Promise<string> {
  const webp = await sharp(input)
    .rotate()
    .resize(MAX_DIM, MAX_DIM, { fit: "inside", withoutEnlargement: true })
    .webp({ quality: WEBP_QUALITY })
    .toBuffer();
  const name = `${Date.now().toString(36)}-${randomBytes(4).toString("hex")}.webp`;
  await mkdir(MEDIA_DIR, { recursive: true });
  await writeFile(path.join(MEDIA_DIR, name), webp);
  return name;
}

/** Apaga o arquivo físico de um asset (best-effort — a linha do banco manda). */
export async function deleteMediaFile(url: string): Promise<void> {
  const name = path.basename(url); // ignora diretórios — só o arquivo
  await unlink(path.join(MEDIA_DIR, name)).catch(() => undefined);
}

// ── Fotos PRIVADAS (foto de referência da cliente — LGPD) ──────────────────
// Ficam num subdir `priv/` do volume; nunca servidas por /media (público).
// Acesso só pela rota autenticada /admin/media. Guardamos só a chave (nome).
export const PRIVATE_MEDIA_DIR = path.join(MEDIA_DIR, "priv");
/** Limite por foto de cliente (LGPD/feature 2): ~5MB antes da compressão. */
export const MAX_BOOKING_PHOTO_BYTES = 5 * 1024 * 1024;

/** Processa uma foto privada (WebP, 1600px) → devolve a chave (nome do arquivo). */
export async function processPrivatePhoto(input: Buffer): Promise<string> {
  const webp = await sharp(input)
    .rotate()
    .resize(MAX_DIM, MAX_DIM, { fit: "inside", withoutEnlargement: true })
    .webp({ quality: WEBP_QUALITY })
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
