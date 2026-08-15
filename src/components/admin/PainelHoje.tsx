import Link from "next/link";
import { DateTime } from "luxon";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";
import { formatBRL } from "@/lib/format";
import { resumoDoMes } from "@/lib/finance/queries";

/**
 * Faixa "Hoje" no topo da Agenda: visão do dia + resultado do mês +
 * aniversariantes + atalhos de 1 toque. Auto-contida (busca seus próprios
 * dados) e sempre referente a HOJE/mês corrente, independente do dia visualizado.
 * Aditiva — não altera a Agenda nem URLs. Tudo reusa libs existentes.
 */
export default async function PainelHoje() {
  const { timezone: tz } = await getSettings();
  const now = DateTime.now().setZone(tz);
  const hojeInicio = now.startOf("day");
  const hojeFim = hojeInicio.plus({ days: 1 });

  const [hojeCount, pendentesCount, resumo, aniversRows] = await Promise.all([
    prisma.booking.count({
      where: {
        status: { in: ["confirmed", "pending"] },
        startsAt: { gte: hojeInicio.toJSDate(), lt: hojeFim.toJSDate() },
      },
    }),
    prisma.booking.count({
      where: { status: "pending", startsAt: { gte: hojeInicio.toJSDate() } },
    }),
    resumoDoMes(now.year, now.month, "caixa").catch(() => null),
    prisma.$queryRaw<{ n: number }[]>`
      SELECT count(*)::int AS n FROM customers
      WHERE birth_date IS NOT NULL
        AND EXTRACT(MONTH FROM birth_date) = EXTRACT(MONTH FROM now())
    `.catch(() => [{ n: 0 }]),
  ]);

  const aniversariantes = aniversRows[0]?.n ?? 0;
  const lucro = resumo?.dre.lucroLiquidoCents ?? null;
  const alerta = resumo?.alertas[0];
  const hojeISO = hojeInicio.toISODate() ?? "";

  return (
    <section className="mb-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card titulo="Hoje" valor={`${hojeCount}`} sub="atendimento(s)" href={`/admin?data=${hojeISO}`} />
        <Card
          titulo="Aguardando"
          valor={`${pendentesCount}`}
          sub="confirmação"
        />
        <Card
          titulo="Resultado do mês"
          valor={lucro != null ? formatBRL(lucro) : "—"}
          sub={now.setLocale("pt-BR").toFormat("LLLL")}
          href="/admin/financeiro"
          tom={lucro == null ? undefined : lucro >= 0 ? "ok" : "alerta"}
        />
        <Card
          titulo="Aniversariantes"
          valor={`${aniversariantes}`}
          sub="este mês"
          href="/admin/crm"
        />
      </div>

      {alerta && (
        <Link
          href="/admin/financeiro"
          className="mt-3 block rounded-mi bg-amber-50 px-4 py-2 text-sm text-amber-900 ring-1 ring-amber-200"
        >
          {alerta}
        </Link>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        <Atalho href="/admin/financeiro/custos" label="Lançar custo" />
        <Atalho href="/admin/clientes" label="Clientes" />
        <Atalho href="/admin/crm" label="Relacionamento" />
        <Atalho href="/admin/resumo" label="Resumo" />
      </div>
    </section>
  );
}

function Card({
  titulo,
  valor,
  sub,
  href,
  tom,
}: {
  titulo: string;
  valor: string;
  sub: string;
  href?: string;
  tom?: "ok" | "alerta";
}) {
  const valorCor =
    tom === "ok"
      ? "text-emerald-700"
      : tom === "alerta"
        ? "text-red-700"
        : "text-mi-marrom-escuro";
  const inner = (
    <>
      <p className="font-corpo text-xs uppercase tracking-wide text-mi-texto/80">
        {titulo}
      </p>
      <p className={`mt-1 font-titulo text-2xl ${valorCor}`}>{valor}</p>
      <p className="font-corpo text-xs capitalize text-mi-texto/80">{sub}</p>
    </>
  );
  const cls =
    "block rounded-mi bg-mi-superficie-elevada p-4 shadow-suave transition-colors";
  return href ? (
    <Link href={href} className={`${cls} hover:bg-mi-bege/40`}>
      {inner}
    </Link>
  ) : (
    <div className={cls}>{inner}</div>
  );
}

function Atalho({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="inline-flex min-h-[44px] items-center rounded-mi border border-mi-cinza bg-mi-superficie-elevada px-4 font-corpo text-sm text-mi-marrom-escuro transition-colors hover:bg-mi-bege/40"
    >
      {label}
    </Link>
  );
}
