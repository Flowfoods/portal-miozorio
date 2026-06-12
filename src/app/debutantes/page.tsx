import type { Metadata } from "next";
import { JsonLd } from "@/components/seo/JsonLd";
import { faqSchema, pageMeta } from "@/lib/seo";

export const metadata: Metadata = pageMeta({
  path: "/debutantes",
  title: "Debutantes · 15 anos · Mi Ozorio",
  description:
    "Maquiagem e penteado para debutantes no Rio de Janeiro com a Milene Ozorio. Pacotes Básico e Master, ensaio externo e acompanhamento na festa.",
  ogTitle: "Debutantes · 15 anos",
});

const WA =
  "https://wa.me/5521970225231?text=Oi%20Mi!%20Quero%20saber%20dos%20pacotes%20de%20debutante%20%F0%9F%92%9B";

const PACOTES = [
  {
    nome: "Pacote Básico",
    preco: "R$ 2.979",
    parcela: "ou 10x R$ 297,90",
    inclui: [
      "Reunião criativa (online ou presencial)",
      "Prévia de maquiagem (até 2 testes)",
      "Prévia de penteado (até 2 testes)",
      "Maquiagem e penteado no dia, conforme planejado",
      "Assistência com vestido, sapato e acessórios",
      "Assessoria durante o making of fotográfico",
      "Deslocamento incluído",
    ],
  },
  {
    nome: "Pacote Master",
    preco: "R$ 4.679",
    parcela: "ou 10x R$ 467,90",
    inclui: [
      "Tudo do Básico, com até 3 testes em cada prévia",
      "Maquiagem e cabelo para ensaio externo",
      "Kit de emergência completo",
      "Produção de 1 acompanhante",
      "Acompanhamento de 4h na festa, com 2 retoques",
    ],
    destaque: true,
  },
];

const ENSAIO = [
  { o: "Maquiagem", v: "R$ 380" },
  { o: "Cabelo", v: "R$ 450" },
  { o: "Pacote (maquiagem + cabelo)", v: "R$ 630" },
  { o: "Acompanhamento exclusivo no ensaio", v: "R$ 1.500" },
];

const FAQ = [
  {
    q: "A debutante precisa estar acompanhada?",
    a: "Sim. Como ela é menor de idade, a comunicação e o contrato são sempre com o responsável, e a prévia é acompanhada por ele.",
  },
  {
    q: "Quantos testes a prévia inclui?",
    a: "No Pacote Básico são até 2 testes em cada prévia (maquiagem e penteado); no Master, até 3 testes em cada.",
  },
  {
    q: "Vocês fazem ensaio externo?",
    a: "Sim! O ensaio externo pode ser contratado avulso (a partir de R$ 380) ou já vem incluso no Pacote Master.",
  },
  {
    q: "Como funciona o pagamento?",
    a: "20% na assinatura do contrato e o restante até 3 dias antes da festa. No cartão, em até 10x sem juros; no PIX, parcelado sem juros.",
  },
  {
    q: "O deslocamento está incluído?",
    a: "Sim, o deslocamento está incluído nos dois pacotes.",
  },
];

export default function DebutantesPage() {
  return (
    <main>
      <JsonLd data={faqSchema(FAQ)} />
      <section className="mx-auto max-w-3xl px-5 py-16 text-center sm:py-24">
        <p className="font-corpo text-xs uppercase tracking-[0.3em] text-mi-marrom">
          15 anos
        </p>
        <h1 className="mt-5 text-balance font-titulo text-5xl leading-tight text-mi-marrom-escuro sm:text-6xl">
          O brilho da debutante, do nosso jeito
        </h1>
        <p className="mx-auto mt-5 max-w-xl font-corpo text-lg font-light text-mi-texto">
          Da reunião criativa ao acompanhamento na festa — com todo o cuidado
          que esse dia tão especial merece. 💛
        </p>
      </section>

      {/* Pacotes */}
      <section className="mx-auto max-w-5xl px-5 py-8">
        <div className="grid gap-6 md:grid-cols-2">
          {PACOTES.map((p) => (
            <article
              key={p.nome}
              className={`flex flex-col rounded-mi border bg-mi-branco p-8 shadow-suave ${
                p.destaque ? "border-mi-marrom" : "border-mi-cinza"
              }`}
            >
              <h2 className="font-titulo text-3xl text-mi-marrom-escuro">
                {p.nome}
              </h2>
              <p className="mt-3 font-titulo text-4xl text-mi-marrom">
                {p.preco}
              </p>
              <p className="mt-1 font-corpo text-xs text-mi-marrom">
                {p.parcela}
              </p>
              <ul className="mt-6 flex-1 space-y-2">
                {p.inclui.map((i) => (
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
            {ENSAIO.map((e) => (
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
          💛 Como a debutante é menor de idade, toda a combinação e o contrato
          são feitos com o responsável, e a prévia é sempre acompanhada por ele.
        </p>
      </section>

      {/* FAQ */}
      <section className="mx-auto max-w-3xl px-5 py-16">
        <h2 className="text-center font-titulo text-3xl text-mi-marrom-escuro">
          Perguntas frequentes
        </h2>
        <div className="mt-8 space-y-3">
          {FAQ.map((f) => (
            <details
              key={f.q}
              className="rounded-mi border border-mi-cinza bg-mi-branco p-5"
            >
              <summary className="cursor-pointer font-corpo font-medium text-mi-marrom-escuro">
                {f.q}
              </summary>
              <p className="mt-2 font-corpo text-sm text-mi-texto">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* CTA WhatsApp (R1) */}
      <section className="mx-auto max-w-2xl px-5 pb-20 text-center">
        <h2 className="text-balance font-titulo text-4xl text-mi-marrom-escuro">
          Bora planejar essa festa?
        </h2>
        <p className="mx-auto mt-4 max-w-md font-corpo text-mi-texto">
          Me chama no WhatsApp que eu preparo uma proposta sob medida 💛
        </p>
        <a
          href={WA}
          className="mt-8 inline-flex min-h-[52px] items-center justify-center rounded-mi bg-mi-marrom px-8 font-corpo text-base text-mi-branco shadow-suave transition-colors hover:bg-mi-marrom-escuro"
        >
          Falar com a Mi
        </a>
      </section>
    </main>
  );
}
