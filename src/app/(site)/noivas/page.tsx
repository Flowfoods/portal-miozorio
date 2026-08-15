import type { Metadata } from "next";
import { JsonLd } from "@/components/seo/JsonLd";
import { faqSchema, pageMeta } from "@/lib/seo";
import { getSiteContent, parseTabela } from "@/lib/content";
import { getPacotes, getFaqs } from "@/lib/pacotes";
import Botao from "@/components/ui/Botao";

// Sem isto a página é prerenderizada UMA vez, no build — onde não existe
// DATABASE_URL — e serve para sempre o PACOTES_FALLBACK do código. A noiva lia
// um preço no site e outro na proposta, e só saía de lá quando a Mi salvasse
// um pacote por acaso (refreshVitrines). Mesmo teto de 1h da home.
export const revalidate = 3600;

export const metadata: Metadata = pageMeta({
  path: "/noivas",
  title: "Noivas · La Mariée · Mi Ozorio",
  description:
    "Maquiagem e penteado de noiva no Rio de Janeiro com a Milene Ozorio. Reunião criativa, prévia e exclusividade no grande dia. Pacotes La Mariée.",
  ogTitle: "Noivas · La Mariée",
});

const WA =
  "https://wa.me/5521970225231?text=Oi%20Mi!%20Sou%20noiva%20e%20quero%20uma%20proposta";

export default async function NoivasPage() {
  const [content, pacotes, faqs] = await Promise.all([
    getSiteContent(),
    getPacotes("noiva"),
    getFaqs("noiva"),
  ]);
  const jornada = parseTabela(content["noivas.jornada.lista"] ?? "");
  return (
    <main>
      <JsonLd
        data={faqSchema(faqs.map((f) => ({ q: f.pergunta, a: f.resposta })))}
      />
      <section className="mx-auto max-w-3xl px-5 py-16 text-center sm:py-24">
        <span className="inline-block rounded-full border border-mi-cinza bg-mi-branco px-4 py-1.5 font-corpo text-[11px] uppercase tracking-[0.15em] text-mi-marrom-escuro">
          Atendimento exclusivo — uma noiva por dia
        </span>
        <p className="mt-6 font-corpo text-xs uppercase tracking-[0.3em] text-mi-marrom">
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
          {jornada.map((j, i) => (
            <div key={j.o} className="relative">
              <span className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-mi-marrom/40 bg-mi-branco font-titulo text-xl text-mi-marrom shadow-suave">
                {String(i + 1).padStart(2, "0")}
              </span>
              {i < jornada.length - 1 && (
                <span
                  aria-hidden
                  className="absolute left-14 top-6 hidden h-px w-[calc(100%-4rem)] bg-mi-cinza sm:block"
                />
              )}
              <h2 className="mt-4 font-titulo text-2xl text-mi-marrom-escuro">
                {j.o}
              </h2>
              <p className="mt-2 font-corpo text-sm text-mi-texto">{j.v}</p>
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
              className={`relative flex flex-col rounded-mi border bg-mi-branco p-8 shadow-suave ${
                p.destaque ? "border-mi-marrom" : "border-mi-cinza"
              }`}
            >
              {p.destaque && (
                <span className="absolute -top-3 left-8 rounded-full bg-mi-marrom px-3 py-1 font-corpo text-[11px] uppercase tracking-[0.15em] text-mi-branco">
                  Mais escolhido
                </span>
              )}
              <h3 className="font-titulo text-3xl text-mi-marrom-escuro">
                {p.nome}
              </h3>
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
            <li className="flex gap-2.5">
              <span
                aria-hidden
                className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-mi-marrom"
              />
              <span>
                A prévia inclui até <strong>3 ajustes</strong> de maquiagem;
                acima disso, há uma taxa de R$ 120.
              </span>
            </li>
            <li className="flex gap-2.5">
              <span
                aria-hidden
                className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-mi-marrom"
              />
              <span>
                Venha decidida quanto a cores e estilo, com suas referências
                separadas.
              </span>
            </li>
            <li className="flex gap-2.5">
              <span
                aria-hidden
                className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-mi-marrom"
              />
              <span>
                Sem celular durante a prévia e no dia — sua atenção (e a minha)
                toda no momento.
              </span>
            </li>
            <li className="flex gap-2.5">
              <span
                aria-hidden
                className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-mi-marrom"
              />
              <span>
                O deslocamento está incluído dentro do Rio de Janeiro. Outras
                cidades: combinamos taxa e hospedagem.
              </span>
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
      <section className="bg-mi-superficie-nav">
        <div className="mx-auto max-w-2xl px-5 py-20 text-center">
          <h2 className="text-balance font-titulo text-4xl text-mi-marrom-escuro">
            {content["noivas.cta.title"]}
          </h2>
          <p className="mx-auto mt-4 max-w-md font-corpo text-mi-texto">
            {content["noivas.cta.subtitle"]}
          </p>
          <Botao href={WA} className="mt-8">
            {content["noivas.cta.button"]}
          </Botao>
        </div>
      </section>
    </main>
  );
}
