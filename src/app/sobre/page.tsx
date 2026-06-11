import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo";

export const metadata: Metadata = pageMeta({
  path: "/sobre",
  title: "Sobre a Mi · Milene Ozorio Beauty Artist",
  description:
    "Conheça a Milene Ozorio: 12 anos de experiência em maquiagem e penteado, estúdio em Santíssimo, RJ. Formações em HD, colorimetria, pele negra e visagismo.",
  ogTitle: "Sobre a Mi",
});

const FORMACOES = [
  "Maquiagem HD (foto e TV)",
  "Maquiagem à prova d'água",
  "Colorimetria",
  "Pele negra",
  "Visagismo",
  "Penteados",
  "Assessoria a noivas e debutantes",
];

const MAPA =
  "https://www.google.com/maps?q=Rua+Ipom%C3%A9ia,+5,+Sant%C3%ADssimo,+Rio+de+Janeiro&output=embed";

export default function SobrePage() {
  return (
    <main>
      <section className="mx-auto grid max-w-5xl items-center gap-10 px-5 py-16 sm:py-24 md:grid-cols-2">
        <div>
          <p className="font-corpo text-xs uppercase tracking-[0.3em] text-mi-marrom">
            Sobre a Mi
          </p>
          <h1 className="mt-5 font-titulo text-5xl leading-tight text-mi-marrom-escuro">
            12 anos realçando belezas
          </h1>
          <p className="mt-5 font-corpo text-lg font-light text-mi-texto">
            Sou a Milene — Mi, pra você. Há mais de uma década cuido da beleza de
            noivas, debutantes e mulheres em seus momentos mais especiais, com
            técnica, sensibilidade e muito carinho.
          </p>
          <p className="mt-4 font-corpo text-mi-texto">
            Acredito que maquiagem boa é aquela que realça quem você já é — então
            cada produção começa te ouvindo, entendendo a sua história e a
            ocasião.
          </p>
        </div>
        <div className="aspect-[4/5] w-full overflow-hidden rounded-mi bg-mi-cinza shadow-suave">
          <div className="flex h-full items-center justify-center font-corpo text-sm text-mi-marrom/70">
            foto da Mi
          </div>
        </div>
      </section>

      {/* Formações */}
      <section className="bg-mi-branco/50 py-16">
        <div className="mx-auto max-w-5xl px-5">
          <h2 className="text-center font-titulo text-3xl text-mi-marrom-escuro">
            Formações
          </h2>
          <ul className="mx-auto mt-8 flex max-w-3xl flex-wrap justify-center gap-3">
            {FORMACOES.map((f) => (
              <li
                key={f}
                className="rounded-mi border border-mi-cinza bg-mi-branco px-4 py-2 font-corpo text-sm text-mi-texto"
              >
                {f}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Estúdio */}
      <section className="mx-auto max-w-5xl px-5 py-16">
        <div className="grid items-center gap-10 md:grid-cols-2">
          <div>
            <h2 className="font-titulo text-3xl text-mi-marrom-escuro">
              O estúdio
            </h2>
            <p className="mt-4 font-corpo text-mi-texto">
              Um ambiente familiar e climatizado, com manequim para o vestido e
              capacidade para até 6 pessoas (incluindo as profissionais de
              beleza). O lugar perfeito para a sua prévia e o seu grande dia.
            </p>
            <p className="mt-4 font-corpo text-mi-marrom-escuro">
              Rua Ipoméia, 5 — Vila Maria, Santíssimo, Rio de Janeiro
            </p>
          </div>
          <div className="aspect-video w-full overflow-hidden rounded-mi border border-mi-cinza shadow-suave">
            <iframe
              src={MAPA}
              title="Mapa do estúdio Mi Ozorio"
              className="h-full w-full"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
          </div>
        </div>
      </section>
    </main>
  );
}
