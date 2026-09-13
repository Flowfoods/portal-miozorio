/**
 * Casca única das telas de autenticação (B5) — entrar, esqueci a senha, código,
 * nova senha, nos DOIS portais. Antes cada tela tinha a sua moldura: a do
 * Clube com monograma e cartão, a do painel com um h1 solto na página.
 *
 * Mobile-first de verdade (a cliente chega pelo celular): coluna de 28rem,
 * respiro lateral de 20px, cartão branco sobre o bege da marca e tipografia
 * serifada só no título. Sem componente de cliente — não usa hook nenhum, então
 * serve tanto a página de servidor quanto a client component do painel.
 */
export default function AuthShell({
  eyebrow,
  titulo,
  subtitulo,
  children,
  rodape,
  monograma = true,
}: {
  /** Linha pequena em maiúsculas acima do título ("Clube Mi Ozorio"). */
  eyebrow: string;
  titulo: string;
  subtitulo?: string;
  children: React.ReactNode;
  /** Links de apoio abaixo do cartão. */
  rodape?: React.ReactNode;
  monograma?: boolean;
}) {
  return (
    <main className="mx-auto w-full max-w-md px-5 pb-24 pt-12 sm:pt-14">
      {monograma && (
        <p
          aria-hidden
          className="select-none text-center font-titulo text-5xl font-medium italic text-mi-marrom/25"
        >
          Mi
        </p>
      )}
      <p className="mt-4 text-center font-corpo text-xs uppercase tracking-[0.3em] text-mi-marrom-escuro">
        {eyebrow}
      </p>
      <h1 className="mt-3 text-center font-titulo text-3xl text-mi-marrom-escuro">
        {titulo}
      </h1>
      {subtitulo && (
        <p className="mt-3 text-center font-corpo text-mi-texto/80">
          {subtitulo}
        </p>
      )}
      <div className="mt-8 rounded-mi bg-mi-branco p-6 shadow-suave sm:p-8">
        {children}
      </div>
      {rodape && (
        <div className="mt-6 space-y-1 text-center font-corpo text-sm text-mi-texto/80">
          {rodape}
        </div>
      )}
    </main>
  );
}
