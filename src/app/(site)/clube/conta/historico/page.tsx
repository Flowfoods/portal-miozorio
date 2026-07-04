import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { DateTime } from "luxon";
import { prisma } from "@/lib/prisma";
import { getClienteSession } from "@/lib/cliente-auth";
import { getSettings } from "@/lib/settings";
import ContaShell from "@/components/clube/ContaShell";
import Botao from "@/components/ui/Botao";
import EstadoVazio from "@/components/ui/EstadoVazio";

export const metadata: Metadata = {
  title: "Meu histórico · Mi Ozorio",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const WA_REPETIR = (servico: string) =>
  `https://wa.me/5521970225231?text=${encodeURIComponent(
    `Oi Mi! Quero viver de novo: ${servico} 💛`,
  )}`;

/**
 * Histórico da Área da Cliente (F2): linha do tempo reversa dos atendimentos
 * concluídos, com pontos ganhos e "Repetir esse cuidado". Sem ranking, sem
 * comparação — só a história dela com a Mi (métricas suaves no topo).
 * "Contar como foi" entra na F3 junto com o fluxo de Momentos.
 */
export default async function HistoricoPage() {
  const s = getClienteSession();
  if (!s) redirect("/clube/entrar");
  if (s.prov) redirect("/clube/conta/senha");

  // Isolamento: tudo pelo id da sessão (R18).
  const [customer, bookings, txnsServico, settings] = await Promise.all([
    prisma.customer.findUnique({
      where: { id: s.customerId },
      select: { clubJoinedAt: true },
    }),
    prisma.booking.findMany({
      where: { customerId: s.customerId, status: "completed" },
      orderBy: { startsAt: "desc" },
      take: 60,
      select: {
        id: true,
        startsAt: true,
        location: true,
        service: {
          select: { name: true, code: true, bookableOnline: true, active: true },
        },
        items: { orderBy: { sort: "asc" }, select: { service: { select: { name: true } } } },
      },
    }),
    // Pontos ganhos por atendimento: crédito idempotente service:<bookingId>.
    prisma.clubTransaction.findMany({
      where: { customerId: s.customerId, tipo: "service" },
      select: { dedupKey: true, pontos: true },
    }),
    getSettings(),
  ]);
  if (!customer) redirect("/clube/entrar");

  const pontosPorBooking = new Map(
    txnsServico
      .filter((t) => t.dedupKey?.startsWith("service:"))
      .map((t) => [t.dedupKey!.slice("service:".length), t.pontos]),
  );

  const primeiro = bookings[bookings.length - 1];
  const desdeBase = customer.clubJoinedAt ?? primeiro?.startsAt ?? null;
  const desde = desdeBase
    ? DateTime.fromJSDate(desdeBase)
        .setZone(settings.timezone)
        .setLocale("pt-BR")
        .toFormat("LLLL 'de' yyyy")
    : null;

  return (
    <ContaShell ativo="historico">
      <h1 className="font-titulo text-3xl text-mi-marrom-escuro">
        Sua história com a Mi
      </h1>

      {bookings.length === 0 ? (
        <div className="mt-6">
          <EstadoVazio
            titulo="Sua história com a Mi começa no primeiro atendimento 🤎"
            descricao="Escolha um cuidado e viva a experiência — depois ela fica guardada aqui."
            cta={{ label: "Agendar meu horário", href: "/agendar" }}
          />
        </div>
      ) : (
        <>
          {/* Métricas suaves — sem ranking, sem comparação */}
          <div className="mt-4 flex gap-3">
            <div className="flex-1 rounded-mi bg-mi-branco p-4 shadow-suave">
              <p className="font-titulo text-3xl text-mi-marrom-escuro">
                {bookings.length}
              </p>
              <p className="font-corpo text-xs text-mi-texto/60">
                momento(s) de cuidado
              </p>
            </div>
            {desde && (
              <div className="flex-1 rounded-mi bg-mi-branco p-4 shadow-suave">
                <p className="font-titulo text-lg capitalize leading-snug text-mi-marrom-escuro">
                  {desde}
                </p>
                <p className="font-corpo text-xs text-mi-texto/60">
                  cliente desde
                </p>
              </div>
            )}
          </div>

          {/* Linha do tempo */}
          <ol className="mt-8 space-y-6 border-l border-mi-cinza pl-5">
            {bookings.map((b) => {
              const dt = DateTime.fromJSDate(b.startsAt)
                .setZone(settings.timezone)
                .setLocale("pt-BR");
              const nomes =
                b.items.length > 0
                  ? b.items.map((i) => i.service.name).join(" + ")
                  : b.service.name;
              const pontos = pontosPorBooking.get(b.id);
              const agendavel = b.service.bookableOnline && b.service.active;
              return (
                <li key={b.id} className="relative">
                  <span
                    aria-hidden
                    className="absolute -left-[26px] top-1.5 h-2.5 w-2.5 rounded-full bg-mi-marrom ring-4 ring-mi-bege"
                  />
                  <p className="font-corpo text-xs capitalize text-mi-marrom">
                    {dt.toFormat("cccc, dd 'de' LLLL 'de' yyyy")}
                  </p>
                  <div className="mt-2 rounded-mi border border-mi-cinza bg-mi-branco p-4 shadow-suave">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-titulo text-xl leading-snug text-mi-marrom-escuro">
                          {nomes}
                        </p>
                        <p className="mt-0.5 font-corpo text-xs text-mi-texto/60">
                          com a Mi ·{" "}
                          {b.location === "home" ? "em domicílio" : "no estúdio"}
                        </p>
                      </div>
                      {typeof pontos === "number" && pontos > 0 && (
                        <span className="shrink-0 rounded-full bg-mi-bege px-3 py-1 font-corpo text-xs text-mi-marrom-escuro">
                          +{pontos} pontos
                        </span>
                      )}
                    </div>
                    <div className="mt-4">
                      {agendavel ? (
                        <Botao
                          href={`/agendar?servico=${b.service.code}`}
                          variante="secundario"
                          className="w-full !min-h-[46px] text-sm"
                        >
                          Repetir esse cuidado
                        </Botao>
                      ) : (
                        <Botao
                          href={WA_REPETIR(b.service.name)}
                          variante="secundario"
                          className="w-full !min-h-[46px] text-sm"
                        >
                          Combinar com a Mi no WhatsApp
                        </Botao>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        </>
      )}
    </ContaShell>
  );
}
