import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo";
import { prisma } from "@/lib/prisma";
import { formatBRL, formatDuration } from "@/lib/format";
import { getSiteContent } from "@/lib/content";
import Botao from "@/components/ui/Botao";
import EstadoVazio from "@/components/ui/EstadoVazio";

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
            <p className="mt-1 font-corpo text-sm text-mi-texto/80">
              {formatDuration(s.durationMin)} · <Preco s={s} />
            </p>
            <div className="mt-4">
              {s.bookableOnline ? (
                <Botao href={`/agendar?servico=${s.code}`}>Agendar</Botao>
              ) : (
                // Armadilha armada: os dois ramos diziam "Agendar", e o de
                // baixo mandava para /agendar — onde o serviço não aparece,
                // porque /api/services filtra por bookableOnline. Fica
                // dormente enquanto todo serviço de cabelo nasce agendável, e
                // vira beco sem saída no instante em que a Mi desmarcar
                // "Agendável online" no painel.
                <Botao
                  href={`https://wa.me/5521970225231?text=${encodeURIComponent(`Oi Mi! Queria saber sobre ${s.name} 💛`)}`}
                  variante="whatsapp"
                >
                  Combinar com a Mi
                </Botao>
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
        <EstadoVazio
          titulo="Em breve por aqui"
          descricao="Os serviços do dia a dia estão sendo combinados. Enquanto isso, é só chamar a Mi."
          cta={{ label: "Falar com a Mi", href: "https://wa.me/5521970225231?text=Oi%20Mi!%20Vim%20pelo%20site" }}
        />
      ) : (
        <>
          <Lista titulo="Cabelo" itens={cabelo} />
          <Lista titulo="Sobrancelhas" itens={sobrancelha} />
          <p className="mt-2 font-corpo text-sm text-mi-texto/80">
            Valores e horários de alguns serviços ainda estão sendo combinados —
            é só chamar que a Mi te ajuda.
          </p>
        </>
      )}
    </main>
  );
}
