"use client";

import Image from "next/image";
import { useRef, useState } from "react";

/**
 * Grade da galeria com lightbox nativo (V5): <dialog> + CSS, sem lib externa.
 * Esc, clique no backdrop e botão fecham; foco fica no dialog (comportamento
 * nativo de showModal). Alvos ≥44px (R19).
 */
type Foto = { id: string; url: string; alt: string };

export default function GaleriaLightbox({ fotos }: { fotos: Foto[] }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [atual, setAtual] = useState<Foto | null>(null);

  function abrir(foto: Foto) {
    setAtual(foto);
    dialogRef.current?.showModal();
  }
  function fechar() {
    dialogRef.current?.close();
  }

  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {fotos.map((foto) => (
          <button
            key={foto.id}
            type="button"
            onClick={() => abrir(foto)}
            aria-label={`Ampliar foto: ${foto.alt}`}
            className="group relative aspect-[4/5] overflow-hidden rounded-mi bg-mi-bege"
          >
            <Image
              src={foto.url}
              alt={foto.alt}
              fill
              loading="lazy"
              sizes="(max-width: 640px) 50vw, 320px"
              className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
            />
          </button>
        ))}
      </div>

      <dialog
        ref={dialogRef}
        onClose={() => setAtual(null)}
        onClick={(e) => {
          if (e.target === dialogRef.current) fechar();
        }}
        className="w-[92vw] max-w-2xl rounded-mi bg-mi-branco p-2 shadow-suave backdrop:bg-mi-marrom-escuro/60 backdrop:backdrop-blur-sm"
      >
        {atual && (
          <figure>
            <div className="relative max-h-[76vh] w-full overflow-hidden rounded-[10px] bg-mi-bege">
              <Image
                src={atual.url}
                alt={atual.alt}
                width={1200}
                height={1500}
                sizes="92vw"
                className="h-auto max-h-[76vh] w-full object-contain"
              />
            </div>
            <figcaption className="flex min-h-[44px] items-center justify-between gap-3 px-3 py-2">
              <span className="font-corpo text-sm text-mi-texto">
                {atual.alt}
              </span>
              <button
                type="button"
                onClick={fechar}
                className="font-corpo text-sm text-mi-marrom underline underline-offset-4 transition-colors hover:text-mi-marrom-escuro"
              >
                fechar
              </button>
            </figcaption>
          </figure>
        )}
      </dialog>
    </>
  );
}
