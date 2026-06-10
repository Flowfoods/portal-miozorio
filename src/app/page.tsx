export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 py-20 text-center">
      <p className="font-corpo text-xs uppercase tracking-[0.3em] text-mi-marrom">
        Mi Ozorio · Beauty Artist
      </p>

      <h1 className="mt-6 max-w-2xl text-balance font-titulo text-5xl font-medium leading-tight text-mi-marrom-escuro sm:text-6xl">
        Algo lindo está a caminho
      </h1>

      <p className="mt-6 max-w-md text-balance font-corpo text-lg font-light text-mi-texto">
        Estamos preparando um novo espaço para você agendar sua maquiagem e
        penteado com todo o cuidado e o carinho de sempre. 💛
      </p>

      <a
        href="https://wa.me/5521970225231?text=Oi%20Mi!%20Vim%20pelo%20site%20%F0%9F%92%9B"
        className="mt-10 inline-flex min-h-[48px] items-center justify-center rounded-mi bg-mi-marrom px-8 font-corpo text-base text-mi-branco shadow-suave transition-colors hover:bg-mi-marrom-escuro"
      >
        Falar com a Mi no WhatsApp
      </a>

      <footer className="mt-16 font-corpo text-sm font-light text-mi-marrom">
        Rio de Janeiro · @mileneozorio
      </footer>
    </main>
  );
}
