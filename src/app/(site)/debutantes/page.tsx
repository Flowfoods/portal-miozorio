import type { Metadata } from "next";
import { JsonLd } from "@/components/seo/JsonLd";
import { faqSchema, pageMeta } from "@/lib/seo";
import { getSiteContent, parseTabela } from "@/lib/content";
import { getPacotes, getFaqs } from "@/lib/pacotes";
import Botao from "@/components/ui/Botao";

export const metadata: Metadata = pageMeta({
  path: "/debutantes",
  title: "Debutantes · 15 anos · Mi Ozorio",
  description:
    "Maquiagem e penteado para debutantes no Rio de Janeiro com a Milene Ozorio. Pacotes Básico e Master, ensaio externo e acompanhamento na festa.",
  ogTitle: "Debutantes · 15 anos",
});

const WA =
  "https://wa.me/5521970225231?text=Oi%20Mi!%20Quero%20saber%20dos%20pacotes%20de%20debutante";

export default async function DebutantesPage() {
  const [content, pacotes, faqs] = await Promise.all([
    getSiteContent(),
    getPacotes("debutante"),
    getFaqs("debutante"),
  ]);
  const ensaio = parseTabela(content["debutantes.ensaio.tabela"] ?? "");
  return (
    <main>
      <JsonLd
        data={faqSchema(faqs.map((f) => ({ q: f.pergunta, a: f.resposta })))}
      />
      <section className="mx-auto max-w-3xl px-5 py-16 text-center sm:py-24">
        <span className="inline-block rounded-full border border-mi-cinza bg-mi-branco px-4 py-1.5 font-corpo text-[11px] uppercase tracking-[0.15em] text-mi-marrom-escuro">
          Atendimento exclusivo — uma debutante por dia
        </span>
        <p className="mt-6 font-corpo text-xs uppercase tracking-[0.3em] text-mi-marrom">
          {content["debutantes.hero.eyebrow"]}
        </p>
        <h1 className="mt-5 text-balance font-titulo text-5xl leading-tight text-mi-marrom-escuro sm:text-6xl">
          {content["debutantes.hero.title"]}
        </h1>
        <p className="mx-auto mt-5 max-w-xl font-corpo text-lg font-light text-mi-texto">
          {content["debutantes.hero.subtitle"]}
        </p>
      </section>

      {/* Pacotes */}
      <section className="mx-auto max-w-5xl px-5 py-8">
        <div className="grid gap-6 md:grid-cols-2">
          {pacotes.map((p) => (
            <article
              key={p.nome}
              className={`relative flex flex-col rounded-mi border bg-mi-branco p-8 shadow-suave ${
                p.destaque ? "border-mi-marrom" : "border-mi-cinza"
              }`}
            >
              {p.destaque && (
                <span className="absolute -top-3 left-8 rounded-full bg-mi-marrom px-3 py-1 font-corpo text-[11px] uppercase tracking-[0.15em] text-mi-branco">
                  Mais escolhido
                </span>
              )}
              <h2 className="font-titulo text-3xl text-mi-marrom-escuro">
                {p.nome}
              </h2>
              <p className="mt-3 font-corpo text-4xl font-medium text-mi-marrom">
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
            </article>
          ))}
        </div>
      </section>

      {/* Ensaio externo */}
      <section className="bg-mi-branco/50 py-16">
        <div className="mx-auto max-w-3xl px-5">
          <header className="mb-8 text-center">
            <h2 className="font-titulo text-3xl text-mi-marrom-escuro">
              Ensaio externo
            </h2>
            <p className="mt-2 font-corpo text-sm text-mi-marrom">
              Serviços avulsos para o ensaio pré-festa.
            </p>
          </header>
          <div className="mx-auto max-w-md divide-y divide-mi-cinza rounded-mi border border-mi-cinza bg-mi-branco">
            {ensaio.map((e) => (
              <div
                key={e.o}
                className="flex items-center justify-between px-5 py-4 font-corpo text-mi-texto"
              >
                <span>{e.o}</span>
                <span className="font-medium text-mi-marrom-escuro">{e.v}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Nota responsável (R6) */}
      <section className="mx-auto max-w-2xl px-5 py-12">
        <p className="rounded-mi border border-mi-cinza bg-mi-bege px-6 py-5 text-center font-corpo text-sm text-mi-marrom-escuro">
          Como a debutante é menor de idade, toda a combinação e o contrato
          são feitos com o responsável, e a prévia é sempre acompanhada por ele.
        </p>
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

      {/* CTA WhatsApp (R1) */}
      <section className="bg-mi-superficie-nav">
        <div className="mx-auto max-w-2xl px-5 py-20 text-center">
          <h2 className="text-balance font-titulo text-4xl text-mi-marrom-escuro">
            {content["debutantes.cta.title"]}
          </h2>
          <p className="mx-auto mt-4 max-w-md font-corpo text-mi-texto">
            {content["debutantes.cta.subtitle"]}
          </p>
          <Botao href={WA} className="mt-8">
            {content["debutantes.cta.button"]}
          </Botao>
        </div>
      </section>
    </main>
  );
}
