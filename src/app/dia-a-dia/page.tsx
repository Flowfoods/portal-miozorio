import type { Metadata } from "next";
import Link from "next/link";
import { pageMeta } from "@/lib/seo";
import { prisma } from "@/lib/prisma";
import { formatBRL, formatDuration } from "@/lib/format";
import { getSiteContent } from "@/lib/content";

// Catálogo vem do banco e não tem hook de revalidação (preços/serviços mudam
// no admin). Dinâmico garante frescor; a query é pequena e o SSR mantém o SEO.
export const dynamic = "force-dynamic";

export const metadata: Metadata = pageMeta({
  path: "/dia-a-dia",
  title: "Dia a dia · cabelo e sobrancelhas · Mi Ozorio",
  description:
    "Cuidados de cabelo e sobrancelhas com a Milene Ozorio: escova, hidratação, reconstrução, cronograma capilar, design e henna. Agende o seu horário.",
  ogTitle: "Dia a dia",
});

type Servico = {
  code: string;
  name: string;
  durationMin: number;
  priceCents: number;
  pendingPrice: boolean;
  bookableOnline: boolean;
};

/** Catálogo do dia a dia. Sem banco (build) → vazio, sem quebrar (igual mídia). */
async function getDiaADia(): Promise<{ cabelo: Servico[]; sobrancelha: Servico[] }> {
  try {
    const rows = await prisma.service.findMany({
      where: { active: true, category: { in: ["cabelo", "sobrancelha"] } },
      orderBy: [{ category: "asc" }, { name: "asc" }],
      select: {
        code: true,
        name: true,
        durationMin: true,
        priceCents: true,
        pendingPrice: true,
        bookableOnline: true,
        category: true,
      },
    });
    return {
      cabelo: rows.filter((r) => r.category === "cabelo"),
      sobrancelha: rows.filter((r) => r.category === "sobrancelha"),
    };
  } catch {
    return { cabelo: [], sobrancelha: [] };
  }
}

function Preco({ s }: { s: Servico }) {
  if (s.pendingPrice || s.priceCents === 0) {
    return <span className="text-mi-marrom">Valor a combinar</span>;
  }
  return <span className="text-mi-marrom-escuro">{formatBRL(s.priceCents)}</span>;
}

function Lista({ titulo, itens }: { titulo: string; itens: Servico[] }) {
  if (itens.length === 0) return null;
  return (
    <section className="mb-12">
      <h2 className="mb-5 font-titulo text-3xl text-mi-marrom-escuro">{titulo}</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        {itens.map((s) => (
          <div
            key={s.code}
            className="flex flex-col rounded-mi border border-mi-cinza bg-mi-branco p-6 shadow-suave"
          >
            <h3 className="font-titulo text-2xl text-mi-marrom-escuro">{s.name}</h3>
            <p className="mt-1 font-corpo text-sm text-mi-texto/70">
              {formatDuration(s.durationMin)} · <Preco s={s} />
            </p>
            <div className="mt-4">
              {s.bookableOnline ? (
                <Link
                  href={`/agendar?servico=${s.code}`}
                  className="inline-flex min-h-[48px] items-center justify-center rounded-mi bg-mi-marrom px-6 font-corpo text-mi-branco transition-colors hover:bg-mi-marrom-escuro"
                >
                  Agendar
                </Link>
              ) : (
                <Link
                  href="/agendar"
                  className="inline-flex min-h-[48px] items-center justify-center rounded-mi border border-mi-marrom px-6 font-corpo text-mi-marrom-escuro transition-colors hover:bg-mi-cinza"
                >
                  Agendar
                </Link>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export default async function DiaADiaPage() {
  const { cabelo, sobrancelha } = await getDiaADia();
  const content = await getSiteContent();
  const vazio = cabelo.length === 0 && sobrancelha.length === 0;

  return (
    <main className="mx-auto max-w-4xl px-5 py-16">
      <header className="mb-12">
        <h1 className="font-titulo text-5xl text-mi-marrom-escuro">
          {content["diaadia.intro.title"]}
        </h1>
        <p className="mt-4 max-w-2xl font-corpo text-lg text-mi-texto/80">
          {content["diaadia.intro.subtitle"]}
        </p>
      </header>

      {vazio ? (
        <p className="font-corpo text-mi-texto/70">
          Em breve, os serviços do dia a dia por aqui.
        </p>
      ) : (
        <>
          <Lista titulo="Cabelo" itens={cabelo} />
          <Lista titulo="Sobrancelhas" itens={sobrancelha} />
          <p className="mt-2 font-corpo text-sm text-mi-texto/60">
            Valores e horários de alguns serviços ainda estão sendo combinados —
            é só chamar que a Mi te ajuda. 💛
          </p>
        </>
      )}
    </main>
  );
}
