/**
 * Fallback elegante enquanto não há foto publicada (M8.4): bloco bege com o
 * monograma da Mi — nunca texto tipo "foto 1" (R12). Preenche o contêiner pai
 * (que define o aspect ratio), então não causa CLS quando a foto chegar.
 */
export default function MonogramPlaceholder() {
  return (
    <div
      aria-hidden
      className="flex h-full w-full items-center justify-center bg-mi-bege"
    >
      <span className="select-none font-titulo text-6xl font-medium italic text-mi-marrom/30">
        Mi
      </span>
    </div>
  );
}
