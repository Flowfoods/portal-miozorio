import type { Metadata } from "next";
import { JsonLd } from "@/components/seo/JsonLd";
import { faqSchema, pageMeta } from "@/lib/seo";
import { getSiteContent } from "@/lib/content";
import { getPacotes, getFaqs } from "@/lib/pacotes";

export const metadata: Metadata = pageMeta({
  path: "/noivas",
  title: "Noivas · La Mariée · Mi Ozorio",
  description:
    "Maquiagem e penteado de noiva no Rio de Janeiro com a Milene Ozorio. Reunião criativa, prévia e exclusividade no grande dia. Pacotes La Mariée.",
  ogTitle: "Noivas · La Mariée",
});

const WA =
  "https://wa.me/5521970225231?text=Oi%20Mi!%20Sou%20noiva%20e%20quero%20uma%20proposta%20%F0%9F%92%9B";

const JORNADA = [
  {
    n: "01",
    t: "Reunião criativa",
    d: "A gente conversa sobre o estilo da festa, suas referências, o vestido e a sua personalidade — para desenhar a produção perfeita pra você.",
  },
  {
    n: "02",
    t: "Prévia",
    d: "Um mês antes, no estúdio, 3h dedicadas a testar maquiagem e penteado exatamente como serão no dia. Você sai segura e encantada.",
  },
  {
    n: "03",
    t: "O grande dia",
    d: "Exclusividade total: chego antes de você e só saio quando você partir para a cerimônia. Cada detalhe no lugar, com calma e carinho.",
  },
];

export default async function NoivasPage() {
  const [content, pacotes, faqs] = await Promise.all([
    getSiteContent(),
    getPacotes("noiva"),
    getFaqs("noiva"),
  ]);
  return (
    <main>
      <JsonLd
        data={faqSchema(faqs.map((f) => ({ q: f.pergunta, a: f.resposta })))}
      />
      <section className="mx-auto max-w-3xl px-5 py-16 text-center sm:py-24">
        <p className="font-corpo text-xs uppercase tracking-[0.3em] text-mi-marrom">
          {content["noivas.hero.eyebrow"]}
        </p>
        <h1 className="mt-5 text-balance font-titulo text-5xl leading-tight text-mi-marrom-escuro sm:text-6xl">
          {content["noivas.hero.title"]}
        </h1>
        <p className="mx-auto mt-5 max-w-xl font-corpo text-lg font-light text-mi-texto">
          {content["noivas.hero.subtitle"]}
        </p>
      </section>

      {/* Jornada */}
      <section className="mx-auto max-w-5xl px-5 py-8">
        <div className="grid gap-8 sm:grid-cols-3">
          {JORNADA.map((j) => (
            <div key={j.n}>
              <span className="font-titulo text-3xl text-mi-marrom">{j.n}</span>
              <h2 className="mt-2 font-titulo text-2xl text-mi-marrom-escuro">
                {j.t}
              </h2>
              <p className="mt-2 font-corpo text-sm text-mi-texto">{j.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Pacotes */}
      <section className="mx-auto max-w-5xl px-5 py-16">
        <header className="mb-10 text-center">
          <h2 className="font-titulo text-4xl text-mi-marrom-escuro">
            Pacotes La Mariée
          </h2>
        </header>
        <div className="grid gap-6 md:grid-cols-2">
          {pacotes.map((p) => (
            <article
              key={p.nome}
              className={`flex flex-col rounded-mi border bg-mi-branco p-8 shadow-suave ${
                p.destaque ? "border-mi-marrom" : "border-mi-cinza"
              }`}
            >
              <h3 className="font-titulo text-3xl text-mi-marrom-escuro">
                {p.nome}
              </h3>
              <p className="mt-3 font-titulo text-4xl text-mi-marrom">
                {p.preco}
              </p>
              {p.parcela && (
                <p className="mt-1 font-corpo text-xs text-mi-marrom">
                  {p.parcela}
                </p>
              )}
              <ul className="mt-6 flex-1 space-y-2">
                {p.itens.map((i) => (
                  <li
                    key={i}
                    className="flex gap-2 font-corpo text-sm text-mi-texto"
                  >
                    <span className="text-mi-marrom">•</span>
                    {i}
                  </li>
                ))}
              </ul>
              {p.rodape && (
                <p className="mt-5 rounded-mi bg-mi-bege px-4 py-3 font-corpo text-sm text-mi-marrom-escuro">
                  {p.rodape}
                </p>
              )}
            </article>
          ))}
        </div>
      </section>

      {/* Regras com elegância */}
      <section className="bg-mi-branco/50 py-16">
        <div className="mx-auto max-w-3xl px-5">
          <h2 className="text-center font-titulo text-3xl text-mi-marrom-escuro">
            Pra tudo sair perfeito
          </h2>
          <ul className="mx-auto mt-8 max-w-xl space-y-3 font-corpo text-sm text-mi-texto">
            <li>
              ✦ A prévia inclui até <strong>3 ajustes</strong> de maquiagem;
              acima disso, há uma taxa de R$ 120.
            </li>
            <li>
              ✦ Venha decidida quanto a cores e estilo, com suas referências
              separadas.
            </li>
            <li>
              ✦ Sem celular durante a prévia e no dia — sua atenção (e a minha)
              toda no momento.
            </li>
            <li>
              ✦ O deslocamento está incluído dentro do Rio de Janeiro. Outras
              cidades: combinamos taxa e hospedagem.
            </li>
          </ul>
        </div>
      </section>

      {/* FAQ */}
      <section className="mx-auto max-w-3xl px-5 py-16">
        <h2 className="text-center font-titulo text-3xl text-mi-marrom-escuro">
          Perguntas frequentes
        </h2>
        <div className="mt-8 space-y-3">
          {faqs.map((f) => (
            <details
              key={f.pergunta}
              className="rounded-mi border border-mi-cinza bg-mi-branco p-5"
            >
              <summary className="cursor-pointer font-corpo font-medium text-mi-marrom-escuro">
                {f.pergunta}
              </summary>
              <p className="mt-2 font-corpo text-sm text-mi-texto">
                {f.resposta}
              </p>
            </details>
          ))}
        </div>
      </section>

      {/* CTA único — WhatsApp (R1) */}
      <section className="mx-auto max-w-2xl px-5 py-20 text-center">
        <h2 className="text-balance font-titulo text-4xl text-mi-marrom-escuro">
          {content["noivas.cta.title"]}
        </h2>
        <p className="mx-auto mt-4 max-w-md font-corpo text-mi-texto">
          {content["noivas.cta.subtitle"]}
        </p>
        <a
          href={WA}
          className="mt-8 inline-flex min-h-[52px] items-center justify-center rounded-mi bg-mi-marrom px-8 font-corpo text-base text-mi-branco shadow-suave transition-colors hover:bg-mi-marrom-escuro"
        >
          {content["noivas.cta.button"]}
        </a>
      </section>
    </main>
  );
}
