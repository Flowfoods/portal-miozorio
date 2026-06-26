import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo";
import { prisma } from "@/lib/prisma";
import JoinForm from "@/components/clube/JoinForm";

export const metadata: Metadata = pageMeta({
  path: "/clube",
  title: "Clube Mi Ozorio · Junte pontos e ganhe mimos",
  description:
    "O clube de quem se cuida com a Mi Ozorio: junte pontos a cada atendimento e a cada indicação, e troque por recompensas. Participar é grátis.",
  ogTitle: "Clube Mi Ozorio",
});

export const dynamic = "force-dynamic";

const PASSOS = [
  {
    n: "01",
    t: "Entre no clube",
    d: "É grátis: você ganha sua carteirinha digital e um link de indicação só seu.",
  },
  {
    n: "02",
    t: "Junte pontos",
    d: "Você ganha pontos a cada atendimento — e também quando uma amiga indicada se cuida com a Mi pela primeira vez.",
  },
  {
    n: "03",
    t: "Troque por mimos",
    d: "Acumule e use seus pontos nas recompensas do clube: prêmios e serviços escolhidos pela Mi.",
  },
];

export default async function ClubePage() {
  const recompensas = await prisma.clubReward
    .findMany({
      where: { ativo: true },
      orderBy: [{ sort: "asc" }, { custoPontos: "asc" }],
    })
    .catch(() => []);

  return (
    <main className="mx-auto max-w-5xl px-5 pb-24 pt-14">
      {/* Hero */}
      <section className="text-center">
        <p className="font-corpo text-xs uppercase tracking-[0.3em] text-mi-marrom">
          Clube Mi Ozorio
        </p>
        <h1 className="mx-auto mt-3 max-w-2xl text-4xl leading-tight sm:text-5xl">
          Cada cuidado vale pontos — e mimos pra você
        </h1>
        <p className="mx-auto mt-4 max-w-xl font-corpo text-mi-texto/80">
          Entre no clube, junte pontos a cada atendimento e a cada amiga que você
          indica, e troque por recompensas especiais da Mi.
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

      {/* Recompensas */}
      {recompensas.length > 0 && (
        <section className="mt-20">
          <h2 className="text-center text-3xl">Recompensas do clube</h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            {recompensas.map((r) => (
              <div
                key={r.id}
                className="rounded-mi border border-mi-cinza bg-mi-branco p-6 text-center shadow-suave"
              >
                <p className="font-corpo text-3xl font-medium text-mi-marrom-escuro">
                  {r.custoPontos}
                </p>
                <p className="font-corpo text-xs uppercase tracking-[0.2em] text-mi-marrom">
                  pontos
                </p>
                <p className="mt-3 font-corpo text-sm text-mi-texto/85">{r.nome}</p>
                <p className="mt-1 font-corpo text-xs text-mi-texto/60">
                  {r.tipo === "servico" ? "Serviço" : "Prêmio"}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      <p className="mx-auto mt-10 max-w-xl text-center font-corpo text-xs text-mi-texto/60">
        Produções de noiva ou debutante são sempre combinadas direto com a Mi no
        WhatsApp — cada grande dia é um projeto único
      </p>

      {/* Participar */}
      <section id="participar" className="mt-16 scroll-mt-24">
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
