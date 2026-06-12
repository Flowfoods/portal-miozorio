import Link from "next/link";
import Image from "next/image";
import { JsonLd } from "@/components/seo/JsonLd";
import { beautySalonSchema, pageMeta } from "@/lib/seo";
import { getPublishedMedia } from "@/lib/media";
import MonogramPlaceholder from "@/components/site/MonogramPlaceholder";

// ISR: as fotos vêm do banco (media_assets). Mudanças no painel chamam
// revalidatePath("/") e aparecem na hora; 1h é só o teto de segurança.
export const revalidate = 3600;

export const metadata = pageMeta({
  path: "/",
  title: "Milene Ozorio · Beauty Artist · Maquiagem e penteado RJ",
  description:
    "Maquiagem e penteado para noivas, debutantes e festas no Rio de Janeiro. Agendamento online com a maquiadora Milene Ozorio.",
  ogTitle: "Maquiagem & Penteado no RJ",
});

const SERVICOS = [
  {
    nome: "Maquiagem social",
    desc: "Madrinha, formanda, ensaio ou aquele evento que pede um brilho especial.",
    preco: "a partir de R$ 250",
  },
  {
    nome: "Penteado",
    desc: "Do clássico ao moderno, modelado do seu jeito e pra durar a festa toda.",
    preco: "a partir de R$ 350",
  },
  {
    nome: "Pacote completo",
    desc: "Maquiagem e penteado juntos — você pronta pra brilhar, sem correria.",
    preco: "a partir de R$ 550",
  },
  {
    nome: "Sobrancelhas",
    desc: "Design, henna e brow lamination para emoldurar o seu olhar.",
    preco: "sob consulta",
  },
  {
    nome: "Curso de automaquiagem",
    desc: "Uma aula individual de 2h para você aprender a se maquiar com confiança.",
    preco: "R$ 280",
  },
];

const DIFERENCIAIS = [
  {
    t: "12 anos de experiência",
    d: "Mãos firmes, olhar treinado e muita história cuidando da beleza de cada cliente.",
  },
  {
    t: "Maquiagem HD à prova d'água",
    d: "Acabamento perfeito em foto e vídeo, resistente ao calor, à emoção e às lágrimas.",
  },
  {
    t: "Cruelty-free 🐰",
    d: "Produtos de alta qualidade, com benefícios para a pele e nunca testados em animais.",
  },
  {
    t: "Cílios de fios naturais",
    d: "Aplicados em todas as produções, para um olhar marcante e leve ao mesmo tempo.",
  },
  {
    t: "Visagismo & colorimetria",
    d: "Cada produção pensada para o seu rosto, seu tom de pele e a sua ocasião.",
  },
  {
    t: "Exclusividade no grande dia",
    d: "Noivas e debutantes têm a atenção total da Mi — uma cliente por vez.",
  },
];

// ⚠️ Depoimentos ilustrativos — substituir pelos reais da Mi (pendência).
const DEPOIMENTOS = [
  {
    txt: "A Mi entendeu exatamente o que eu queria. Me senti a versão mais bonita de mim mesma.",
    nome: "Ana · madrinha",
  },
  {
    txt: "Maquiagem impecável o dia inteiro, mesmo com calor e emoção. Recomendo de olhos fechados.",
    nome: "Carol · formanda",
  },
  {
    txt: "Cuidado, carinho e um resultado de tirar o fôlego. Já virou minha maquiadora oficial.",
    nome: "Bia · noiva",
  },
];

export default async function Home() {
  const [heroFoto] = await getPublishedMedia("hero", 1);
  const portfolio = await getPublishedMedia("portfolio", 6);
  return (
    <main>
      <JsonLd data={beautySalonSchema} />
      {/* HERO */}
      <section className="mx-auto grid max-w-5xl items-center gap-10 px-5 py-16 sm:py-24 md:grid-cols-2">
        <div>
          <p className="font-corpo text-xs uppercase tracking-[0.3em] text-mi-marrom">
            Milene Ozorio · Beauty Artist · RJ
          </p>
          <h1 className="mt-5 text-balance font-titulo text-5xl leading-[1.05] text-mi-marrom-escuro sm:text-6xl">
            Sua beleza, realçada com cuidado e arte
          </h1>
          <p className="mt-5 max-w-md font-corpo text-lg font-light text-mi-texto">
            Maquiagem e penteado para noivas, debutantes e os seus momentos mais
            especiais, no coração do Rio de Janeiro. 💛
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/agendar"
              className="inline-flex min-h-[52px] items-center justify-center rounded-mi bg-mi-marrom px-7 font-corpo text-base text-mi-branco shadow-suave transition-colors hover:bg-mi-marrom-escuro"
            >
              Agendar meu horário
            </Link>
            <Link
              href="/#especiais"
              className="inline-flex min-h-[52px] items-center justify-center rounded-mi border border-mi-marrom px-7 font-corpo text-base text-mi-marrom-escuro transition-colors hover:bg-mi-cinza"
            >
              Sou noiva ou debutante 💛
            </Link>
          </div>
        </div>

        <div className="relative aspect-[4/5] w-full overflow-hidden rounded-mi bg-mi-bege shadow-suave">
          {heroFoto ? (
            <Image
              src={heroFoto.url}
              alt={heroFoto.alt}
              fill
              priority
              sizes="(max-width: 768px) 100vw, 480px"
              className="object-cover"
            />
          ) : (
            <MonogramPlaceholder />
          )}
        </div>
      </section>

      {/* SERVIÇOS */}
      <section id="servicos" className="mx-auto max-w-5xl px-5 py-16">
        <header className="mb-10 text-center">
          <h2 className="font-titulo text-4xl text-mi-marrom-escuro">
            Serviços
          </h2>
          <p className="mt-2 font-corpo text-mi-marrom">
            Escolha o seu e agende em poucos toques.
          </p>
        </header>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {SERVICOS.map((s) => (
            <Link
              key={s.nome}
              href="/agendar"
              className="group flex flex-col rounded-mi border border-mi-cinza bg-mi-branco p-6 shadow-suave transition-colors hover:border-mi-marrom"
            >
              <h3 className="font-titulo text-2xl text-mi-marrom-escuro">
                {s.nome}
              </h3>
              <p className="mt-2 flex-1 font-corpo text-sm text-mi-texto">
                {s.desc}
              </p>
              <p className="mt-4 font-corpo text-sm font-medium text-mi-marrom">
                {s.preco}
              </p>
            </Link>
          ))}
        </div>
      </section>

      {/* DIFERENCIAIS */}
      <section className="bg-mi-branco/50 py-16">
        <div className="mx-auto max-w-5xl px-5">
          <header className="mb-10 text-center">
            <h2 className="font-titulo text-4xl text-mi-marrom-escuro">
              Por que a Mi
            </h2>
          </header>
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {DIFERENCIAIS.map((d) => (
              <div key={d.t}>
                <h3 className="font-titulo text-xl text-mi-marrom-escuro">
                  {d.t}
                </h3>
                <p className="mt-2 font-corpo text-sm text-mi-texto">{d.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PORTFÓLIO */}
      <section className="mx-auto max-w-5xl px-5 py-16">
        <header className="mb-10 text-center">
          <h2 className="font-titulo text-4xl text-mi-marrom-escuro">
            Portfólio
          </h2>
          <p className="mt-2 font-corpo text-mi-marrom">
            Um pouquinho do que a gente cria junto.
          </p>
        </header>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {portfolio.length > 0
            ? portfolio.map((foto) => (
                <div
                  key={foto.id}
                  className="relative aspect-[4/5] overflow-hidden rounded-mi bg-mi-bege"
                >
                  <Image
                    src={foto.url}
                    alt={foto.alt}
                    fill
                    loading="lazy"
                    sizes="(max-width: 640px) 50vw, 320px"
                    className="object-cover"
                  />
                </div>
              ))
            : Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="aspect-[4/5] overflow-hidden rounded-mi"
                >
                  <MonogramPlaceholder />
                </div>
              ))}
        </div>
      </section>

      {/* DEPOIMENTOS */}
      <section className="bg-mi-branco/50 py-16">
        <div className="mx-auto max-w-5xl px-5">
          <header className="mb-10 text-center">
            <h2 className="font-titulo text-4xl text-mi-marrom-escuro">
              Quem já viveu
            </h2>
          </header>
          <div className="grid gap-6 sm:grid-cols-3">
            {DEPOIMENTOS.map((d) => (
              <figure
                key={d.nome}
                className="rounded-mi border border-mi-cinza bg-mi-branco p-6 shadow-suave"
              >
                <blockquote className="font-corpo text-mi-texto">
                  “{d.txt}”
                </blockquote>
                <figcaption className="mt-4 font-corpo text-sm text-mi-marrom">
                  {d.nome}
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      {/* ESPECIAIS — noivas e debutantes */}
      <section id="especiais" className="mx-auto max-w-5xl px-5 py-16">
        <header className="mb-10 text-center">
          <h2 className="font-titulo text-4xl text-mi-marrom-escuro">
            Noivas & Debutantes
          </h2>
          <p className="mt-2 font-corpo text-mi-marrom">
            Atendimentos exclusivos, com reunião, prévia e todo o cuidado do
            grande dia.
          </p>
        </header>
        <div className="grid gap-6 sm:grid-cols-2">
          {[
            {
              titulo: "La Mariée",
              sub: "Para noivas",
              desc: "Uma experiência completa, da reunião criativa à prévia e ao dia do “sim”.",
              href: "/noivas",
            },
            {
              titulo: "Debutantes",
              sub: "Para os 15 anos",
              desc: "Pacotes pensados para a debutante brilhar — com carinho e atenção aos pais.",
              href: "/debutantes",
            },
          ].map((c) => (
            <Link
              key={c.href}
              href={c.href}
              className="group rounded-mi border border-mi-cinza bg-mi-branco p-8 shadow-suave transition-colors hover:border-mi-marrom"
            >
              <p className="font-corpo text-xs uppercase tracking-[0.25em] text-mi-marrom">
                {c.sub}
              </p>
              <h3 className="mt-2 font-titulo text-3xl text-mi-marrom-escuro">
                {c.titulo}
              </h3>
              <p className="mt-3 font-corpo text-sm text-mi-texto">{c.desc}</p>
              <span className="mt-5 inline-block font-corpo text-sm text-mi-marrom group-hover:text-mi-marrom-escuro">
                Ver mais ›
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* CTA FINAL */}
      <section className="mx-auto max-w-3xl px-5 py-20 text-center">
        <h2 className="text-balance font-titulo text-4xl text-mi-marrom-escuro sm:text-5xl">
          Vamos cuidar da sua beleza?
        </h2>
        <p className="mx-auto mt-4 max-w-md font-corpo text-mi-texto">
          Escolha o seu horário em poucos toques. Estou te esperando 💛
        </p>
        <Link
          href="/agendar"
          className="mt-8 inline-flex min-h-[52px] items-center justify-center rounded-mi bg-mi-marrom px-8 font-corpo text-base text-mi-branco shadow-suave transition-colors hover:bg-mi-marrom-escuro"
        >
          Agendar meu horário
        </Link>
      </section>
    </main>
  );
}
