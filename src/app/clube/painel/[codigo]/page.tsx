import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DateTime } from "luxon";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";
import {
  contarIndicacoesFechadas,
  segmentoDe,
  SEGMENTO_LABEL,
  SEGMENTO_STYLE,
} from "@/lib/clube";

export const metadata: Metadata = {
  title: "Minha carteirinha · Clube Mi Ozorio",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://miozorio.com.br";

/**
 * Área da membro, acessada pelo link com o código dela (não adivinhável; sem
 * dado pessoal na URL). Mostra só o necessário: primeiro nome, escada e link
 * de indicação — nada de telefone/endereço (R18).
 */
export default async function PainelMembroPage({
  params,
}: {
  params: { codigo: string };
}) {
  const membro = await prisma.customer.findUnique({
    where: { referralCode: params.codigo },
    include: {
      milestones: { orderBy: { nivel: "asc" } },
      _count: { select: { referrals: true } },
    },
  });
  if (!membro?.clubJoinedAt) notFound();

  const [settings, fechadas, ocasioes, ultima] = await Promise.all([
    getSettings(),
    contarIndicacoesFechadas(membro.id),
    prisma.booking.count({
      where: { customerId: membro.id, status: "completed" },
    }),
    prisma.booking.findFirst({
      where: { customerId: membro.id, status: "completed" },
      orderBy: { startsAt: "desc" },
      select: { startsAt: true },
    }),
  ]);

  const segmento = segmentoDe({
    ocasioes,
    ultimaOcasiao: ultima?.startsAt ?? null,
    indicacoesFechadas: fechadas,
  });

  const linkIndicacao = `${SITE}/indicar/${membro.referralCode}`;
  const desde = DateTime.fromJSDate(membro.clubJoinedAt)
    .setZone(settings.timezone)
    .setLocale("pt-BR")
    .toFormat("LLLL 'de' yyyy");
  const shareText = encodeURIComponent(
    `Oi! Eu me arrumo com a Mi Ozorio e acho que você vai amar 💛 Conta que eu indiquei: ${linkIndicacao}`,
  );
  const atingidoPorNivel = new Map(membro.milestones.map((m) => [m.nivel, m]));

  return (
    <main className="mx-auto max-w-lg px-5 pb-24 pt-12">
      {/* Carteirinha digital */}
      <section
        className="rounded-2xl border border-mi-cinza bg-gradient-to-br from-mi-branco to-mi-bege p-6 shadow-suave"
        aria-label="Carteirinha do Clube Mi Ozorio"
      >
        <div className="flex items-start justify-between">
          <div>
            <p className="font-titulo text-2xl text-mi-marrom-escuro">
              Mi Ozorio
            </p>
            <p className="font-corpo text-[10px] uppercase tracking-[0.25em] text-mi-marrom">
              Clube · Beauty Artist
            </p>
          </div>
          <span
            className={`rounded-full px-3 py-1 font-corpo text-xs ${SEGMENTO_STYLE[segmento]}`}
          >
            {SEGMENTO_LABEL[segmento]}
          </span>
        </div>
        <p className="mt-8 font-titulo text-xl text-mi-texto">{membro.name}</p>
        <div className="mt-1 flex items-end justify-between">
          <p className="font-corpo text-xs capitalize text-mi-texto/60">
            membro desde {desde}
          </p>
          <p className="font-corpo text-xs tracking-widest text-mi-marrom">
            {membro.referralCode}
          </p>
        </div>
      </section>
      <p className="mt-3 text-center font-corpo text-xs text-mi-texto/60">
        Guarde o link desta página — ela é a sua carteirinha 💛
      </p>

      {/* Indicações */}
      <section className="mt-10 rounded-mi bg-mi-branco p-6 shadow-suave">
        <h2 className="text-2xl">Suas indicações</h2>
        <p className="mt-2 font-corpo text-sm text-mi-texto/80">
          <strong>{fechadas}</strong> amiga(s) já se cuidaram com a Mi pela sua
          indicação
          {membro._count.referrals > fechadas && (
            <> · {membro._count.referrals - fechadas} aguardando o primeiro atendimento</>
          )}
          .
        </p>
        <a
          href={`https://wa.me/?text=${shareText}`}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 inline-flex min-h-[48px] w-full items-center justify-center rounded-mi bg-mi-marrom px-6 font-corpo text-mi-branco transition-colors hover:bg-mi-marrom-escuro"
        >
          Compartilhar meu link no WhatsApp
        </a>
        <p className="mt-3 break-all text-center font-corpo text-xs text-mi-texto/60">
          {linkIndicacao}
        </p>
      </section>

      {/* Escada */}
      <section className="mt-6 rounded-mi bg-mi-branco p-6 shadow-suave">
        <h2 className="text-2xl">Sua escada de mimos</h2>
        <ul className="mt-4 space-y-3">
          {settings.clubLadder.map((step) => {
            const marco = atingidoPorNivel.get(step.nivel);
            const faltam = step.nivel - fechadas;
            return (
              <li
                key={step.nivel}
                className={`rounded-mi border p-4 ${
                  marco
                    ? "border-mi-marrom bg-mi-bege/50"
                    : "border-mi-cinza"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="font-corpo text-sm font-medium text-mi-marrom-escuro">
                    {step.nivel}ª indicação realizada
                  </p>
                  {marco ? (
                    <span className="rounded-full bg-emerald-100 px-3 py-0.5 font-corpo text-xs text-emerald-900">
                      {marco.resgatadoEm ? "mimo entregue 💛" : "mimo liberado!"}
                    </span>
                  ) : (
                    <span className="font-corpo text-xs text-mi-texto/50">
                      {faltam === 1 ? "falta 1" : `faltam ${faltam}`}
                    </span>
                  )}
                </div>
                <p className="mt-1 font-corpo text-sm text-mi-texto/80">
                  {step.beneficio}
                </p>
                {marco && !marco.resgatadoEm && (
                  <p className="mt-2 font-corpo text-xs text-mi-texto/60">
                    Combine com a Mi na sua próxima visita 💛
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      </section>
    </main>
  );
}
