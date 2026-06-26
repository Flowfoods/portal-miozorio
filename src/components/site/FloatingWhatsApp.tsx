/**
 * CTA flutuante de WhatsApp — discreto, presente em todo o site público.
 * Conversão sempre a um toque, sem precisar rolar até o footer. Sai do caminho
 * de leitura (canto inferior direito) e tem alvo ≥48px (R19).
 */
const WA =
  "https://wa.me/5521970225231?text=Oi%20Mi!%20Vim%20pelo%20site%20e%20quero%20tirar%20uma%20d%C3%BAvida";

export default function FloatingWhatsApp() {
  return (
    <a
      href={WA}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Falar no WhatsApp"
      className="fixed bottom-5 right-5 z-30 inline-flex h-14 w-14 items-center justify-center rounded-full bg-mi-marrom text-mi-branco shadow-suave transition-colors hover:bg-mi-marrom-escuro"
    >
      <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38a9.9 9.9 0 0 0 4.79 1.22h.01c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2Zm5.8 14.16c-.24.68-1.42 1.32-1.95 1.36-.5.05-.96.23-3.24-.68-2.74-1.08-4.49-3.88-4.62-4.06-.14-.18-1.11-1.47-1.11-2.81 0-1.33.7-1.99.95-2.26.24-.27.53-.34.71-.34l.51.01c.16.01.39-.06.6.46.24.57.81 1.96.88 2.1.07.14.12.3.02.48-.09.18-.14.3-.27.46-.14.16-.29.36-.41.48-.14.14-.28.29-.12.57.16.27.71 1.18 1.53 1.91 1.05.94 1.94 1.23 2.21 1.37.27.14.43.12.59-.07.16-.18.68-.79.86-1.07.18-.27.36-.22.6-.13.24.09 1.55.73 1.81.87.27.14.45.2.51.31.07.11.07.63-.17 1.31Z" />
      </svg>
    </a>
  );
}
