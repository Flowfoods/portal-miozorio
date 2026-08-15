import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { DateTime } from "luxon";
import { prisma } from "@/lib/prisma";
import { getClienteSession } from "@/lib/cliente-auth";
import { getSettings } from "@/lib/settings";
import {
  contarIndicacoesFechadas,
  segmentoDe,
  SEGMENTO_LABEL,
  SEGMENTO_STYLE,
} from "@/lib/clube";
import { saldoDoCliente } from "@/lib/clube-pontos";
import Chip from "@/components/ui/Chip";
import WeekStrip, { type DiaStrip } from "@/components/ui/WeekStrip";
import EstadoVazio from "@/components/ui/EstadoVazio";

export const metadata: Metadata = {
  title: "Minha carteirinha · Clube Mi Ozorio",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://miozorio.com.br";

/**
 * Área da membro. Exige SESSÃO da própria dona do código.
 *
 * O código da URL é o MESMO que a membro divulga para convidar amigas
 * (`/indicar/<codigo>`, com texto pronto de WhatsApp) — ele identifica, não
 * autentica. Enquanto esta página abria só com o código, toda pessoa que
 * recebeu uma indicação tinha a chave da carteirinha de quem indicou: nome,
 * saldo, segmento e o PRÓXIMO ATENDIMENTO com dia e hora — a localização
 * física de uma mulher, em horário exato, sem login (R6/R18).
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

  const sessao = getClienteSession();
  if (!sessao) redirect("/clube/entrar");
  // Código de outra pessoa: 404 em vez de 403 — não confirma que o código
  // existe (mesma disciplina de /momentos/foto/[id]).
  if (sessao.customerId !== membro.id) notFound();

  const [settings, fechadas, ocasioes, ultima, saldo, recompensas, proximo] =
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
      // Próximo atendimento da membro (só o dela — R18) para "Minha agenda".
      prisma.booking.findFirst({
        where: {
          customerId: membro.id,
          status: { in: ["pending", "confirmed"] },
          startsAt: { gte: new Date() },
        },
        orderBy: { startsAt: "asc" },
        select: { startsAt: true, service: { select: { name: true } } },
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

  // "Minha agenda": próximos 7 dias, com o dia do atendimento em destaque.
  const hoje = DateTime.now().setZone(settings.timezone).setLocale("pt-BR");
  const proximoDt = proximo
    ? DateTime.fromJSDate(proximo.startsAt)
        .setZone(settings.timezone)
        .setLocale("pt-BR")
    : null;
  const diasAgenda: DiaStrip[] = Array.from({ length: 7 }).map((_, i) => {
    const d = hoje.plus({ days: i });
    return {
      id: d.toISODate() ?? String(i),
      diaSemana: d.toFormat("ccc").replace(".", "").toUpperCase(),
      diaMes: d.toFormat("dd"),
      ativo: proximoDt?.toISODate() === d.toISODate(),
    };
  });
  const primeiroNome = membro.name.trim().split(/\s+/)[0] ?? membro.name;

  return (
    <main className="mx-auto max-w-lg px-5 pb-24 pt-12">
      {/* Saudação + ações rápidas */}
      <h1 className="font-titulo text-3xl text-mi-marrom-escuro">
        Olá, {primeiroNome} 💛
      </h1>
      <div className="mi-carrossel -mx-5 mt-4 px-5">
        <Chip href="/agendar" ativo>
          Agendar
        </Chip>
        <Chip href="#minha-agenda">Minha agenda</Chip>
        <Chip href="#pontos">Meus pontos</Chip>
        <Chip href="https://wa.me/5521970225231?text=Oi%20Mi!">
          Falar com a Mi
        </Chip>
      </div>

      {/* Carteirinha digital */}
      <section
        className="mt-8 rounded-2xl border border-mi-cinza bg-gradient-to-br from-mi-branco to-mi-bege p-6 shadow-suave"
        aria-label="Carteirinha do Clube Mi Ozorio"
      >
        <div className="flex items-start justify-between">
          <div>
            <p className="font-titulo text-2xl text-mi-marrom-escuro">
              Mi Ozorio
            </p>
            <p className="font-corpo text-[10px] uppercase tracking-[0.25em] text-mi-marrom-escuro">
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
          <p className="font-corpo text-xs capitalize text-mi-texto/80">
            membro desde {desde}
          </p>
          <p className="font-corpo text-xs tracking-widest text-mi-marrom-escuro">
            {membro.referralCode}
          </p>
        </div>
      </section>
      <p className="mt-3 text-center font-corpo text-xs text-mi-texto/80">
        Sua carteirinha fica sempre aqui, na sua conta
      </p>

      {/* Minha agenda */}
      <section
        id="minha-agenda"
        className="mt-10 rounded-mi bg-mi-branco p-6 shadow-suave"
      >
        <h2 className="text-2xl">Minha agenda</h2>
        <div className="mt-4">
          <WeekStrip dias={diasAgenda} ariaLabel="Próximos 7 dias" />
        </div>
        {proximo && proximoDt ? (
          <div className="mt-4 flex items-center justify-between gap-4 rounded-mi border border-mi-marrom bg-mi-bege/50 p-4">
            <div>
              <p className="font-corpo text-sm font-medium text-mi-marrom-escuro">
                {proximo.service.name}
              </p>
              <p className="font-corpo text-xs capitalize text-mi-texto/80">
                {proximoDt.toFormat("cccc, dd 'de' LLLL")} ·{" "}
                {proximoDt.toFormat("HH:mm")}
              </p>
            </div>
            <span
              aria-hidden
              className="shrink-0 font-titulo text-2xl text-mi-marrom/40"
            >
              Mi
            </span>
          </div>
        ) : (
          <div className="mt-4">
            <EstadoVazio
              titulo="Nenhum horário marcado"
              descricao="Que tal garantir seu próximo momento de cuidado?"
              cta={{ label: "Agendar um horário", href: "/agendar" }}
            />
          </div>
        )}
      </section>

      {/* Indicações */}
      <section
        id="indicacoes"
        className="mt-6 rounded-mi bg-mi-branco p-6 shadow-suave"
      >
        <h2 className="text-2xl">Suas indicações</h2>
        <p className="mt-2 font-corpo text-sm text-mi-texto/80">
          <strong>{fechadas}</strong> amiga(s) já se cuidaram com a Mi pela sua
          indicação
          {membro._count.referrals > fechadas && (
            <>
              {" "}
              · {membro._count.referrals - fechadas} aguardando o primeiro
              atendimento
            </>
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
        <p className="mt-3 break-all text-center font-corpo text-xs text-mi-texto/80">
          {linkIndicacao}
        </p>
      </section>

      {/* Pontos */}
      <section
        id="pontos"
        className="mt-6 rounded-mi bg-mi-branco p-6 shadow-suave"
      >
        <h2 className="text-2xl">Seus pontos</h2>
        <p className="mt-2 font-corpo text-4xl text-mi-marrom-escuro">
          {saldo}{" "}
          <span className="font-corpo text-base text-mi-texto/80">pontos</span>
        </p>
        <p className="mt-2 font-corpo text-sm text-mi-texto/80">
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
                    podeResgatar
                      ? "border-mi-marrom bg-mi-bege/50"
                      : "border-mi-cinza"
                  }`}
                >
                  <div>
                    <p className="font-corpo text-sm font-medium text-mi-marrom-escuro">
                      {r.nome}
                    </p>
                    <p className="font-corpo text-xs text-mi-texto/80">
                      {r.tipo === "servico" ? "Serviço" : "Prêmio"} ·{" "}
                      {r.custoPontos} pontos
                    </p>
                  </div>
                  <span className="font-corpo text-xs text-mi-texto/80">
                    {podeResgatar
                      ? "disponível"
                      : `faltam ${r.custoPontos - saldo}`}
                  </span>
                </li>
              );
            })}
          </ul>
          <p className="mt-4 font-corpo text-xs text-mi-texto/80">
            Para resgatar, é só combinar com a Mi na sua próxima visita.
          </p>
        </section>
      )}
    </main>
  );
}
