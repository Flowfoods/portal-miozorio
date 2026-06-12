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
