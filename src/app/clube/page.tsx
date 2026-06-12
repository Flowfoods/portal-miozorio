import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo";
import { getClubLadder } from "@/lib/clube";
import JoinForm from "@/components/clube/JoinForm";

export const metadata: Metadata = pageMeta({
  path: "/clube",
  title: "Clube Mi Ozorio · Indique e ganhe mimos",
  description:
    "O clube de quem se cuida com a Mi Ozorio: indique amigas, acompanhe sua escada de mimos e receba carinhos em datas especiais. Participar é grátis.",
  ogTitle: "Clube Mi Ozorio",
});

export const revalidate = 3600;

const PASSOS = [
  {
    n: "01",
    t: "Entre no clube",
    d: "É grátis: você ganha sua carteirinha digital e um link de indicação só seu.",
  },
  {
    n: "02",
    t: "Compartilhe com as amigas",
    d: "Mandou o link no WhatsApp, pronto. Quando a amiga agendar por ele, a indicação fica registrada no seu nome.",
  },
  {
    n: "03",
    t: "Suba na escada de mimos",
    d: "A cada amiga que realiza um atendimento com a Mi, você avança — e os mimos vão ficando melhores.",
  },
];

const ORDINAL: Record<number, string> = { 1: "1ª", 3: "3ª", 5: "5ª" };

export default async function ClubePage() {
  const clubLadder = await getClubLadder();

  return (
    <main className="mx-auto max-w-5xl px-5 pb-24 pt-14">
      {/* Hero */}
      <section className="text-center">
        <p className="font-corpo text-xs uppercase tracking-[0.3em] text-mi-marrom">
          Clube Mi Ozorio
        </p>
        <h1 className="mx-auto mt-3 max-w-2xl text-4xl leading-tight sm:text-5xl">
          Quem indica quem ama, ganha mimo da Mi
        </h1>
        <p className="mx-auto mt-4 max-w-xl font-corpo text-mi-texto/80">
          Você se arrumou com a Mi, amou, e a sua amiga perguntou onde foi?
          Agora essa indicação vale carinho de verdade: entre no clube, ganhe
          seu link e acompanhe seus mimos 💛
        </p>
        <a
          href="#participar"
          className="mt-8 inline-flex min-h-[48px] items-center rounded-mi bg-mi-marrom px-8 font-corpo text-mi-branco transition-colors hover:bg-mi-marrom-escuro"
        >
          Quero participar
        </a>
      </section>

      {/* Como funciona */}
      <section className="mt-20">
        <h2 className="text-center text-3xl">Como funciona</h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          {PASSOS.map((p) => (
            <div key={p.n} className="rounded-mi bg-mi-branco p-6 shadow-suave">
              <p className="font-titulo text-2xl text-mi-marrom">{p.n}</p>
              <h3 className="mt-2 text-xl">{p.t}</h3>
              <p className="mt-2 font-corpo text-sm text-mi-texto/80">{p.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Escada de indicação */}
      <section className="mt-20">
        <h2 className="text-center text-3xl">Sua escada de mimos</h2>
        <p className="mx-auto mt-3 max-w-xl text-center font-corpo text-sm text-mi-texto/70">
          O marco conta quando a amiga indicada <strong>realiza</strong> o
          atendimento — aí o mimo é seu.
        </p>
        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          {clubLadder.map((step) => (
            <div
              key={step.nivel}
              className="rounded-mi border border-mi-cinza bg-mi-branco p-6 text-center shadow-suave"
            >
              <p className="font-titulo text-3xl text-mi-marrom-escuro">
                {ORDINAL[step.nivel] ?? `${step.nivel}ª`}
              </p>
              <p className="font-corpo text-xs uppercase tracking-[0.2em] text-mi-marrom">
                indicação realizada
              </p>
              <p className="mt-3 font-corpo text-sm text-mi-texto/85">
                {step.beneficio}
              </p>
            </div>
          ))}
        </div>
        <p className="mx-auto mt-6 max-w-xl text-center font-corpo text-xs text-mi-texto/60">
          Mimos envolvendo produção de noiva ou debutante são sempre combinados
          direto com a Mi no WhatsApp — cada grande dia é um projeto único 💛
        </p>
      </section>

      {/* Participar */}
      <section id="participar" className="mt-20 scroll-mt-24">
        <div className="mx-auto max-w-lg rounded-mi bg-mi-branco p-6 shadow-suave sm:p-8">
          <h2 className="text-2xl">Entrar no clube</h2>
          <p className="mb-6 mt-2 font-corpo text-sm text-mi-texto/70">
            Leva menos de um minuto — e já sai com seu link de indicação.
          </p>
          <JoinForm />
        </div>
      </section>
    </main>
  );
}
