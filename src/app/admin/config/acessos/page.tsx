import Link from "next/link";
import { DateTime } from "luxon";
import { exigirSessaoDoPainel } from "@/lib/auth-painel";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";
import { formatPhoneBR } from "@/lib/format";
import { identificadorVisivel } from "@/lib/authlog";

export const dynamic = "force-dynamic";

/** Rótulos gentis dos eventos de auth (Auth F1.2) — nada de jargão de sistema. */
const EVENTO: Record<string, { label: string; tom: string }> = {
  login_ok: { label: "Entrou", tom: "text-mi-sucesso-tinta" },
  login_fail: { label: "Tentativa que não deu certo", tom: "text-mi-texto/80" },
  locked: {
    label: "Conta pausada (tentativas demais)",
    tom: "text-mi-alerta-tinta",
  },
  throttled: {
    label: "Bloqueio por excesso de acessos (IP)",
    tom: "text-mi-alerta-tinta",
  },
  reset_request: {
    label: "Pediu redefinição por e-mail",
    tom: "text-mi-texto/80",
  },
  reset_done: { label: "Redefiniu a senha", tom: "text-mi-sucesso-tinta" },
  recover_request: {
    label: "Pediu recuperação por WhatsApp",
    tom: "text-mi-texto/80",
  },
  recover_ok: { label: "Recuperou a senha", tom: "text-mi-sucesso-tinta" },
  recover_fail: {
    label: "Código de recuperação incorreto",
    tom: "text-mi-texto/80",
  },
  password_changed: { label: "Trocou a senha", tom: "text-mi-sucesso-tinta" },
};

export default async function AcessosPage() {
  await exigirSessaoDoPainel();
  const { timezone: tz } = await getSettings();
  const desde24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const [eventos, falhas24h, entradas24h, recuperacoes] = await Promise.all([
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
    // B3 — trilha da recuperação de senha: quem pediu, quando, quando a Mi foi
    // avisada e quando o código virou senha nova. Sem o código, sem IP em claro.
    prisma.passwordRecovery
      .findMany({ orderBy: { createdAt: "desc" }, take: 30 })
      .catch(() => []),
  ]);

  return (
    <>
      <div className="mb-2 flex items-center gap-3">
        <Link
          href="/admin/config"
          className="text-sm text-mi-marrom-escuro underline"
        >
          ← Configurações
        </Link>
      </div>
      <h1 className="mb-2 text-3xl">Acessos & segurança</h1>
      <p className="mb-6 text-sm text-mi-texto/80">
        Registro dos acessos ao painel e à área da cliente. Sem dados sensíveis:
        o telefone aparece mascarado e o IP nunca é guardado em claro.
      </p>

      <section className="mb-6 grid grid-cols-2 gap-3">
        <div className="rounded-mi bg-mi-branco p-4 shadow-suave">
          <p className="text-xs uppercase tracking-wide text-mi-texto/80">
            Entradas (24h)
          </p>
          <p className="mt-1 font-titulo text-2xl text-mi-marrom-escuro">
            {entradas24h}
          </p>
        </div>
        <div className="rounded-mi bg-mi-branco p-4 shadow-suave">
          <p className="text-xs uppercase tracking-wide text-mi-texto/80">
            Tentativas sem sucesso (24h)
          </p>
          <p className="mt-1 font-titulo text-2xl text-mi-marrom-escuro">
            {falhas24h}
          </p>
        </div>
      </section>

      <section className="mb-8">
        <h2 className="mb-2 text-xl">Códigos de recuperação</h2>
        <p className="mb-3 text-sm text-mi-texto/80">
          Cada pedido de senha nova: quem pediu, se o código chegou no seu
          WhatsApp e se virou senha. O código em si nunca é guardado.
        </p>
        {recuperacoes.length === 0 ? (
          <p className="rounded-mi bg-mi-branco p-6 text-center text-sm text-mi-texto/80 shadow-suave">
            Nenhum pedido ainda 🤎
          </p>
        ) : (
          <ul className="divide-y divide-mi-cinza/60 rounded-mi bg-mi-branco shadow-suave">
            {recuperacoes.map((r) => {
              const hora = (d: Date) =>
                DateTime.fromJSDate(d)
                  .setZone(tz)
                  .setLocale("pt-BR")
                  .toFormat("dd/MM 'às' HH:mm");
              const visivel =
                r.perfil === "cliente"
                  ? formatPhoneBR(r.identificador)
                  : r.identificador;
              return (
                <li key={r.id} className="px-4 py-3 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <p className="min-w-0 truncate font-corpo text-mi-marrom-escuro">
                      {visivel}
                    </p>
                    <span className="shrink-0 rounded-full bg-mi-superficie-nav px-2 py-0.5 text-[11px] uppercase tracking-wide text-mi-marrom-escuro">
                      {r.perfil === "admin" ? "Painel" : "Cliente"}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-mi-texto/80">
                    Pedido {hora(r.createdAt)}
                    {r.origem === "admin"
                      ? " (você gerou no painel)"
                      : ""} ·{" "}
                    {r.notifiedAt
                      ? `avisada ${hora(r.notifiedAt)}`
                      : "aviso não saiu"}{" "}
                    ·{" "}
                    {r.usedAt ? (
                      <span className="text-mi-sucesso-tinta">
                        usado {hora(r.usedAt)}
                      </span>
                    ) : r.expiresAt <= new Date() ? (
                      `venceu ${hora(r.expiresAt)}`
                    ) : (
                      `vale até ${hora(r.expiresAt)}`
                    )}
                    {r.attempts > 0 && ` · ${r.attempts} tentativa(s)`}
                  </p>
                  {r.notifyError && (
                    <p className="mt-1 text-xs text-mi-alerta-tinta">
                      {r.notifyError}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <h2 className="mb-2 text-xl">Entradas e tentativas</h2>
      {eventos.length === 0 ? (
        <p className="rounded-mi bg-mi-branco p-6 text-center text-sm text-mi-texto/80 shadow-suave">
          Nenhum acesso registrado ainda 🤎
        </p>
      ) : (
        <ul className="divide-y divide-mi-cinza/60 rounded-mi bg-mi-branco shadow-suave">
          {eventos.map((e) => {
            const info = EVENTO[e.event] ?? {
              label: e.event,
              tom: "text-mi-texto/80",
            };
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
                  <p className="truncate text-xs text-mi-texto/80">
                    {identificadorVisivel(e.identifier)}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <span className="rounded-full bg-mi-superficie-nav px-2 py-0.5 text-[11px] uppercase tracking-wide text-mi-marrom-escuro">
                    {e.area === "admin" ? "Painel" : "Cliente"}
                  </span>
                  <p className="mt-1 text-xs text-mi-texto/80">{quando}</p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
