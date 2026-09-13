"use client";

import {
  CLIENT_JPEG_QUALITY,
  CLIENT_MAX_DIM,
  CLIENT_SKIP_BYTES,
} from "@/lib/media-shared";

/**
 * Redução de imagem NO NAVEGADOR, antes do upload.
 *
 * Estava dentro de UploadFotos (admin). A A3 precisa do mesmo tratamento no
 * /agendar — a cliente manda a foto do cabelo pelo 4G —, e copiar as ~50 linhas
 * seria criar a segunda versão de uma lógica delicada (memória de Android
 * médio, transparência de PNG). Uma fonte, dois consumidores.
 */

/** Lê só as DIMENSÕES pelo cabeçalho (sem decodificar o raster inteiro). */
function dimensoes(file: File): Promise<{ w: number; h: number } | null> {
  return new Promise((res) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      res({ w: img.naturalWidth, h: img.naturalHeight });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      res(null);
    };
    img.src = url;
  });
}

/** Reduz no navegador quando vale a pena. Falhou/HEIC/PNG/WebP → original.
 * Só JPEG é recomprimido: PNG/WebP podem ter transparência, e reencodar para
 * JPEG pintaria o fundo de preto (achado da revisão do BUG D). */
export async function otimizar(file: File): Promise<File> {
  if (file.size <= CLIENT_SKIP_BYTES) return file;
  if (file.type !== "image/jpeg") return file; // HEIC/PNG/WebP → servidor
  try {
    const dim = await dimensoes(file);
    if (!dim) return file;
    const escala = Math.min(1, CLIENT_MAX_DIM / Math.max(dim.w, dim.h));
    const w = Math.max(1, Math.round(dim.w * escala));
    const h = Math.max(1, Math.round(dim.h * escala));
    // Pedir o decode JÁ redimensionado limita a memória num Android médio
    // (export de 60MP decodificado inteiro ≈ 240MB e mata a aba).
    const bitmap = await createImageBitmap(file, {
      imageOrientation: "from-image",
      resizeWidth: w,
      resizeHeight: h,
      resizeQuality: "high",
    });
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, w, h); // se o browser ignorou o resize, escala aqui
    bitmap.close();
    const blob = await new Promise<Blob | null>((res) =>
      canvas.toBlob(res, "image/jpeg", CLIENT_JPEG_QUALITY),
    );
    if (!blob || blob.size >= file.size) return file; // só se ficou menor
    return new File([blob], file.name.replace(/\.\w+$/, "") + ".jpg", {
      type: "image/jpeg",
    });
  } catch {
    return file;
  }
}

