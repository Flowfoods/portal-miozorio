import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { DateTime } from "luxon";
import { prisma } from "@/lib/prisma";
import { getClienteSession } from "@/lib/cliente-auth";
import { saldoDoCliente } from "@/lib/clube-pontos";
import { getSettings } from "@/lib/settings";
import ContaShell from "@/components/clube/ContaShell";
import Botao from "@/components/ui/Botao";
import EstadoVazio from "@/components/ui/EstadoVazio";

export const metadata: Metadata = {
  title: "Minha área · Mi Ozorio",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * Início da Área da Cliente (F1): saudação, CTA de agendamento em destaque,
 * próximo horário e resumo de pontos. A pergunta que a tela responde:
 * "como foi (e como continua) minha experiência com a Mi?"
 */
export default async function InicioPage() {
  const s = getClienteSession();
  if (!s) redirect("/clube/entrar");
  if (s.prov) redirect("/clube/conta/senha"); // troca obrigatória antes de tudo

  const [customer, saldo, settings, proximo, atendimentos] = await Promise.all([
    prisma.customer.findUnique({
      where: { id: s.customerId },
      select: { name: true },
    }),
    saldoDoCliente(s.customerId),
    getSettings(),
    // Próximo horário da própria cliente (isolamento pela sessão — R18).
    prisma.booking.findFirst({
      where: {
        customerId: s.customerId,
        status: { in: ["pending", "confirmed"] },
        startsAt: { gte: new Date() },
      },
      orderBy: { startsAt: "asc" },
      select: { startsAt: true, service: { select: { name: true } } },
    }),
    prisma.booking.count({
      where: { customerId: s.customerId, status: "completed" },
    }),
  ]);
  if (!customer) redirect("/clube/entrar");

  const primeiroNome = customer.name.trim().split(/\s+/)[0] ?? customer.name;
  const proximoDt = proximo
    ? DateTime.fromJSDate(proximo.startsAt)
        .setZone(settings.timezone)
        .setLocale("pt-BR")
    : null;

  return (
    <ContaShell ativo="inicio">
      <h1 className="font-titulo text-3xl text-mi-marrom-escuro">
        Olá, {primeiroNome} 💛
      </h1>
      {atendimentos > 0 && (
        <p className="mt-1 font-corpo text-sm text-mi-texto/70">
          {atendimentos} momento(s) de cuidado com a Mi até aqui.
        </p>
      )}

      <div className="mt-5">
        <Botao href="/agendar" className="w-full">
          Agendar meu horário
        </Botao>
      </div>

      {/* Próximo horário */}
      <section className="mt-6">
        <h2 className="mb-2 font-titulo text-xl text-mi-marrom-escuro">
          Seu próximo horário
        </h2>
        {proximo && proximoDt ? (
          <div className="flex items-center justify-between gap-4 rounded-mi border border-mi-marrom bg-mi-bege/50 p-4">
            <div>
              <p className="font-corpo text-sm font-medium text-mi-marrom-escuro">
                {proximo.service.name}
              </p>
              <p className="font-corpo text-xs capitalize text-mi-texto/70">
                {proximoDt.toFormat("cccc, dd 'de' LLLL")} ·{" "}
                {proximoDt.toFormat("HH:mm")}
              </p>
            </div>
            <span
              aria-hidden
              className="shrink-0 select-none font-titulo text-2xl italic text-mi-marrom/40"
            >
              Mi
            </span>
          </div>
        ) : (
          <EstadoVazio
            titulo="Nenhum horário marcado"
            descricao="Que tal garantir seu próximo momento de cuidado?"
            cta={{ label: "Ver horários", href: "/agendar" }}
          />
        )}
      </section>

      {/* Resumo de pontos → aba Clube */}
      <Link
        href="/clube/conta/clube"
        className="mt-6 flex items-center justify-between gap-4 rounded-2xl border border-mi-cinza bg-gradient-to-br from-mi-branco to-mi-bege p-6 shadow-suave transition-colors hover:border-mi-marrom"
      >
        <div>
          <p className="font-corpo text-xs uppercase tracking-wide text-mi-texto/55">
            Seus pontos
          </p>
          <p className="font-titulo text-4xl text-mi-marrom-escuro">{saldo}</p>
        </div>
        <span className="font-corpo text-sm text-mi-marrom">
          Ver meu clube ›
        </span>
      </Link>
    </ContaShell>
  );
}
