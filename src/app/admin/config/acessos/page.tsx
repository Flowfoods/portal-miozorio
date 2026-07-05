import Link from "next/link";
import { DateTime } from "luxon";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

/** Rótulos gentis dos eventos de auth (Auth F1.2) — nada de jargão de sistema. */
const EVENTO: Record<string, { label: string; tom: string }> = {
  login_ok: { label: "Entrou", tom: "text-emerald-700" },
  login_fail: { label: "Tentativa que não deu certo", tom: "text-mi-texto/60" },
  locked: { label: "Conta pausada (tentativas demais)", tom: "text-amber-700" },
  throttled: { label: "Bloqueio por excesso de acessos (IP)", tom: "text-amber-700" },
  reset_request: { label: "Pediu redefinição por e-mail", tom: "text-mi-texto/70" },
  reset_done: { label: "Redefiniu a senha", tom: "text-emerald-700" },
  recover_request: { label: "Pediu recuperação por WhatsApp", tom: "text-mi-texto/70" },
  recover_ok: { label: "Recuperou a senha", tom: "text-emerald-700" },
  recover_fail: { label: "Código de recuperação incorreto", tom: "text-mi-texto/60" },
  password_changed: { label: "Trocou a senha", tom: "text-emerald-700" },
};

export default async function AcessosPage() {
  await requireAdmin();
  const { timezone: tz } = await getSettings();
  const desde24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const [eventos, falhas24h, entradas24h] = await Promise.all([
    prisma.authLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    prisma.authLog.count({
      where: {
        event: { in: ["login_fail", "locked", "throttled", "recover_fail"] },
        createdAt: { gte: desde24h },
      },
    }),
    prisma.authLog.count({
      where: { event: "login_ok", createdAt: { gte: desde24h } },
    }),
  ]);

  return (
    <>
      <div className="mb-2 flex items-center gap-3">
        <Link href="/admin/config" className="text-sm text-mi-marrom underline">
          ← Configurações
        </Link>
      </div>
      <h1 className="mb-2 text-3xl">Acessos & segurança</h1>
      <p className="mb-6 text-sm text-mi-texto/70">
        Registro dos acessos ao painel e à área da cliente. Sem dados sensíveis:
        o telefone aparece mascarado e o IP nunca é guardado em claro.
      </p>

      <section className="mb-6 grid grid-cols-2 gap-3">
        <div className="rounded-mi bg-mi-branco p-4 shadow-suave">
          <p className="text-xs uppercase tracking-wide text-mi-texto/55">Entradas (24h)</p>
          <p className="mt-1 font-titulo text-2xl text-mi-marrom-escuro">{entradas24h}</p>
        </div>
        <div className="rounded-mi bg-mi-branco p-4 shadow-suave">
          <p className="text-xs uppercase tracking-wide text-mi-texto/55">Tentativas sem sucesso (24h)</p>
          <p className="mt-1 font-titulo text-2xl text-mi-marrom-escuro">{falhas24h}</p>
        </div>
      </section>

      {eventos.length === 0 ? (
        <p className="rounded-mi bg-mi-branco p-6 text-center text-sm text-mi-texto/60 shadow-suave">
          Nenhum acesso registrado ainda 🤎
        </p>
      ) : (
        <ul className="divide-y divide-mi-cinza/60 rounded-mi bg-mi-branco shadow-suave">
          {eventos.map((e) => {
            const info = EVENTO[e.event] ?? { label: e.event, tom: "text-mi-texto/70" };
            const quando = DateTime.fromJSDate(e.createdAt)
              .setZone(tz)
              .setLocale("pt-BR")
              .toFormat("dd/MM 'às' HH:mm");
            return (
              <li
                key={String(e.id)}
                className="flex items-center justify-between gap-3 px-4 py-3 text-sm"
              >
                <div className="min-w-0">
                  <p className={`font-corpo ${info.tom}`}>{info.label}</p>
                  <p className="truncate text-xs text-mi-texto/55">
                    {e.identifier ?? "—"}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <span className="rounded-full bg-mi-superficie-nav px-2 py-0.5 text-[11px] uppercase tracking-wide text-mi-marrom-escuro">
                    {e.area === "admin" ? "Painel" : "Cliente"}
                  </span>
                  <p className="mt-1 text-xs text-mi-texto/55">{quando}</p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
