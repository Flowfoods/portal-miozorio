import Link from "next/link";

const WHATSAPP =
  "https://wa.me/5521970225231?text=Oi%20Mi!%20Vim%20pelo%20site%20%F0%9F%92%9B";

export default function Footer() {
  return (
    <footer className="mt-24 border-t border-mi-cinza bg-mi-branco/40">
      <div className="mx-auto grid max-w-5xl gap-8 px-5 py-12 sm:grid-cols-3">
        <div>
          <p className="font-titulo text-xl text-mi-marrom-escuro">Mi Ozorio</p>
          <p className="mt-1 font-corpo text-sm text-mi-marrom">
            Maquiagem & penteado · Rio de Janeiro
          </p>
        </div>

        <div className="font-corpo text-sm text-mi-texto">
          <p className="mb-2 font-medium text-mi-marrom-escuro">Contato</p>
          <a href={WHATSAPP} className="block hover:underline">
            WhatsApp (21) 97022-5231
          </a>
          <a
            href="https://instagram.com/mileneozorio"
            className="block hover:underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            @mileneozorio
          </a>
        </div>

        <div className="font-corpo text-sm text-mi-texto">
          <p className="mb-2 font-medium text-mi-marrom-escuro">Estúdio</p>
          <p>Rua Ipoméia, 5 — Santíssimo, RJ</p>
          <Link href="/privacidade" className="mt-2 inline-block hover:underline">
            Política de privacidade
          </Link>
        </div>
      </div>

      <div className="flex items-center justify-center gap-3 border-t border-mi-cinza/60 py-4 text-center font-corpo text-xs text-mi-marrom">
        <span>© {new Date().getFullYear()} Milene Ozorio · Beauty Artist</span>
        <span aria-hidden>·</span>
        <Link href="/admin" className="hover:underline">
          Área da Mi
        </Link>
      </div>
    </footer>
  );
}
