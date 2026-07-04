import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { DateTime } from "luxon";
import { prisma } from "@/lib/prisma";
import { getClienteSession } from "@/lib/cliente-auth";
import { getSaldoExtrato } from "@/lib/clube-pontos";
import { contarIndicacoesFechadas } from "@/lib/clube";
import ContaShell from "@/components/clube/ContaShell";
import { resgatarAction } from "../actions";

export const metadata: Metadata = {
  title: "Meu clube · Mi Ozorio",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://miozorio.com.br";

const TIPO_LABEL: Record<string, string> = {
  service: "Atendimento",
  referral: "Indicação",
  redemption: "Resgate",
  manual: "Ajuste",
  depoimento: "Depoimento",
  foto: "Foto",
  reagendamento: "Voltou 💛",
};

/**
 * Aba Clube da Área da Cliente (F1): o conteúdo da antiga /clube/conta migrado
 * INTACTO — saldo/progresso, indicação, recompensas+resgate e extrato.
 */
export default async function ClubeTabPage() {
  const s = getClienteSession();
  if (!s) redirect("/clube/entrar");
  if (s.prov) redirect("/clube/conta/senha");

  // Isolamento: TUDO pelo id da sessão — nunca por parâmetro do request.
  const [customer, { saldo, extrato }, recompensas, fechadas, vouchers] =
    await Promise.all([
      prisma.customer.findUnique({
        where: { id: s.customerId },
        select: { name: true, referralCode: true },
      }),
      getSaldoExtrato(s.customerId),
      prisma.clubReward.findMany({
        where: { ativo: true },
        orderBy: { custoPontos: "asc" },
      }),
      contarIndicacoesFechadas(s.customerId),
      prisma.clubVoucher.findMany({
        where: { customerId: s.customerId },
        orderBy: { createdAt: "desc" },
        take: 10,
      }),
    ]);
  if (!customer) redirect("/clube/entrar");

  const proximo = recompensas.find((r) => r.custoPontos > saldo);
  const faltam = proximo ? proximo.custoPontos - saldo : 0;
  const progresso = proximo
    ? Math.min(100, Math.round((saldo / proximo.custoPontos) * 100))
    : 100;
  const link = `${SITE}/indicar/${customer.referralCode}`;
  const share = encodeURIComponent(
    `Oi! Eu me cuido com a Mi Ozorio e acho que você vai amar 💛 Conta que fui eu: ${link}`,
  );

  return (
    <ContaShell ativo="clube">
      <h1 className="font-titulo text-3xl text-mi-marrom-escuro">Meu clube</h1>

      {/* Saldo + progresso */}
      <section className="mt-4 rounded-2xl border border-mi-cinza bg-gradient-to-br from-mi-branco to-mi-bege p-6 shadow-suave">
        <p className="font-corpo text-xs uppercase tracking-wide text-mi-texto/55">
          Seus pontos
        </p>
        <p className="font-titulo text-5xl text-mi-marrom-escuro">{saldo}</p>
        {proximo ? (
          <div className="mt-4">
            <div className="h-2 w-full overflow-hidden rounded-full bg-mi-cinza">
              <div
                className="h-full rounded-full bg-mi-marrom"
                style={{ width: `${progresso}%` }}
              />
            </div>
            <p className="mt-1.5 font-corpo text-sm text-mi-texto/70">
              Faltam <strong>{faltam}</strong> ponto(s) para “{proximo.nome}”.
            </p>
          </div>
        ) : (
          <p className="mt-3 font-corpo text-sm text-mi-texto/70">
            Você já pode resgatar tudo do catálogo 💛
          </p>
        )}
      </section>

      {/* Link de indicação */}
      <section className="mt-6 rounded-mi bg-mi-branco p-5 shadow-suave">
        <h2 className="font-titulo text-xl text-mi-marrom-escuro">
          Indique e ganhe
        </h2>
        <p className="mt-1 font-corpo text-sm text-mi-texto/70">
          {fechadas} amiga(s) já se cuidaram pela sua indicação. Você ganha
          pontos quando elas são atendidas.
        </p>
        <a
          href={`https://wa.me/?text=${share}`}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 inline-flex min-h-[48px] w-full items-center justify-center rounded-mi bg-mi-marrom px-6 font-corpo text-mi-branco transition-colors hover:bg-mi-marrom-escuro"
        >
          Compartilhar no WhatsApp
        </a>
        <p className="mt-3 break-all text-center font-corpo text-xs text-mi-texto/60">
          {link}
        </p>
      </section>

      {/* Recompensas (catálogo + resgate self-service) */}
      <section className="mt-6 rounded-mi bg-mi-branco p-5 shadow-suave">
        <h2 className="font-titulo text-xl text-mi-marrom-escuro">Recompensas</h2>
        {recompensas.length === 0 ? (
          <p className="mt-2 font-corpo text-sm text-mi-texto/60">
            Em breve, recompensas pra você trocar seus pontos 💛
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {recompensas.map((r) => {
              const podeResgatar = saldo >= r.custoPontos;
              return (
                <li
                  key={r.id}
                  className="flex items-center justify-between gap-3 rounded-mi border border-mi-cinza p-3"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-corpo text-sm text-mi-texto">
                      {r.nome}
                    </span>
                    <span className="font-corpo text-xs text-mi-texto/55">
                      {r.custoPontos} pontos
                    </span>
                  </span>
                  {podeResgatar ? (
                    <form action={resgatarAction}>
                      <input type="hidden" name="rewardId" value={r.id} />
                      <button className="shrink-0 rounded-mi bg-mi-marrom px-4 py-2 font-corpo text-sm text-mi-branco transition-colors hover:bg-mi-marrom-escuro">
                        Resgatar
                      </button>
                    </form>
                  ) : (
                    <span className="shrink-0 font-corpo text-xs text-mi-texto/50">
                      faltam {r.custoPontos - saldo}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        {vouchers.length > 0 && (
          <div className="mt-4 border-t border-mi-cinza/60 pt-3">
            <p className="font-corpo text-xs uppercase tracking-wide text-mi-texto/55">
              Meus resgates
            </p>
            <ul className="mt-2 space-y-1.5">
              {vouchers.map((v) => (
                <li
                  key={v.id}
                  className="flex items-center justify-between gap-2 font-corpo text-sm"
                >
                  <span className="min-w-0 truncate text-mi-texto/80">
                    {v.rewardNome} ·{" "}
                    <span className="font-mono text-mi-marrom-escuro">{v.codigo}</span>
                  </span>
                  <span
                    className={`shrink-0 text-xs ${
                      v.status === "entregue" ? "text-emerald-700" : "text-amber-700"
                    }`}
                  >
                    {v.status === "entregue" ? "entregue" : "mostre na visita"}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {/* Extrato */}
      <section className="mt-6">
        <h2 className="mb-2 font-titulo text-xl text-mi-marrom-escuro">Extrato</h2>
        {extrato.length === 0 ? (
          <p className="rounded-mi bg-mi-branco p-6 text-center font-corpo text-sm text-mi-texto/55 shadow-suave">
            Seus pontos vão aparecer aqui depois do seu próximo atendimento 💛
          </p>
        ) : (
          <ul className="space-y-2">
            {extrato.map((t) => (
              <li
                key={t.id}
                className="flex items-center justify-between gap-3 rounded-mi bg-mi-branco p-3 shadow-suave"
              >
                <span className="min-w-0">
                  <span className="block truncate font-corpo text-sm text-mi-texto">
                    {t.descricao || TIPO_LABEL[t.tipo] || "Movimento"}
                  </span>
                  <span className="font-corpo text-xs text-mi-texto/55">
                    {DateTime.fromJSDate(t.createdAt)
                      .setZone("America/Sao_Paulo")
                      .toFormat("dd/LL/yyyy")}
                  </span>
                </span>
                <span
                  className={`shrink-0 font-corpo text-sm font-medium ${
                    t.pontos >= 0 ? "text-emerald-700" : "text-mi-marrom"
                  }`}
                >
                  {t.pontos >= 0 ? "+" : ""}
                  {t.pontos}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </ContaShell>
  );
}
