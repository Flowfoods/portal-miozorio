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
import { saldoDoCliente } from "@/lib/clube-pontos";

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
      _count: { select: { referrals: true } },
    },
  });
  if (!membro?.clubJoinedAt) notFound();

  const [settings, fechadas, ocasioes, ultima, saldo, recompensas] =
    await Promise.all([
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
      saldoDoCliente(membro.id),
      prisma.clubReward.findMany({
        where: { ativo: true },
        orderBy: [{ sort: "asc" }, { custoPontos: "asc" }],
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
    `Oi! Eu me arrumo com a Mi Ozorio e acho que você vai amar Conta que eu indiquei: ${linkIndicacao}`,
  );

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
        Guarde o link desta página — ela é a sua carteirinha
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

      {/* Pontos */}
      <section className="mt-6 rounded-mi bg-mi-branco p-6 shadow-suave">
        <h2 className="text-2xl">Seus pontos</h2>
        <p className="mt-2 font-corpo text-4xl text-mi-marrom-escuro">
          {saldo}{" "}
          <span className="font-corpo text-base text-mi-texto/60">pontos</span>
        </p>
        <p className="mt-2 font-corpo text-sm text-mi-texto/70">
          Você ganha pontos a cada atendimento e quando uma indicação sua faz o
          primeiro atendimento. Acumule e troque pelas recompensas abaixo.
        </p>
      </section>

      {/* Recompensas */}
      {recompensas.length > 0 && (
        <section className="mt-6 rounded-mi bg-mi-branco p-6 shadow-suave">
          <h2 className="text-2xl">Recompensas</h2>
          <ul className="mt-4 space-y-3">
            {recompensas.map((r) => {
              const podeResgatar = saldo >= r.custoPontos;
              return (
                <li
                  key={r.id}
                  className={`flex items-center justify-between gap-2 rounded-mi border p-4 ${
                    podeResgatar ? "border-mi-marrom bg-mi-bege/50" : "border-mi-cinza"
                  }`}
                >
                  <div>
                    <p className="font-corpo text-sm font-medium text-mi-marrom-escuro">
                      {r.nome}
                    </p>
                    <p className="font-corpo text-xs text-mi-texto/60">
                      {r.tipo === "servico" ? "Serviço" : "Prêmio"} ·{" "}
                      {r.custoPontos} pontos
                    </p>
                  </div>
                  <span className="font-corpo text-xs text-mi-texto/60">
                    {podeResgatar ? "disponível" : `faltam ${r.custoPontos - saldo}`}
                  </span>
                </li>
              );
            })}
          </ul>
          <p className="mt-4 font-corpo text-xs text-mi-texto/60">
            Para resgatar, é só combinar com a Mi na sua próxima visita.
          </p>
        </section>
      )}
    </main>
  );
}
