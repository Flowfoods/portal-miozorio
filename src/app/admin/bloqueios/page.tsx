import { DateTime } from "luxon";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";
import { adminCreateBlock, adminDeleteBlock } from "../actions";

export const dynamic = "force-dynamic";

export default async function AdminBloqueiosPage() {
  const settings = await getSettings();
  const tz = settings.timezone;
  const blocks = await prisma.scheduleBlock.findMany({
    where: { endsAt: { gte: new Date() } },
    orderBy: { startsAt: "asc" },
  });

  return (
    <>
      <h1 className="mb-2 text-3xl">Bloqueios de agenda</h1>
      <p className="mb-6 text-sm text-mi-texto/70">
        Férias, eventos fechados ou compromissos: o período bloqueado some dos
        horários oferecidos no site.
      </p>

      <form
        action={adminCreateBlock}
        className="mb-8 grid gap-3 rounded-mi bg-mi-branco p-4 shadow-suave sm:grid-cols-[1fr_1fr_1fr_auto]"
      >
        <label className="text-xs">
          Início
          <input
            className="input-mi mt-1 !py-2"
            type="datetime-local"
            name="startsAt"
            required
          />
        </label>
        <label className="text-xs">
          Fim
          <input
            className="input-mi mt-1 !py-2"
            type="datetime-local"
            name="endsAt"
            required
          />
        </label>
        <label className="text-xs">
          Motivo (opcional)
          <input
            className="input-mi mt-1 !py-2"
            name="reason"
            placeholder="ex.: casamento fechado"
          />
        </label>
        <button className="self-end rounded-mi bg-mi-marrom px-4 py-2.5 text-sm text-white">
          Bloquear
        </button>
      </form>

      <div className="space-y-3">
        {blocks.length === 0 && (
          <p className="rounded-mi bg-mi-branco p-6 text-sm text-mi-texto/60 shadow-suave">
            Nenhum bloqueio futuro.
          </p>
        )}
        {blocks.map((b) => {
          const starts = DateTime.fromJSDate(b.startsAt).setZone(tz);
          const ends = DateTime.fromJSDate(b.endsAt).setZone(tz);
          return (
            <div
              key={b.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-mi bg-mi-branco p-4 shadow-suave"
            >
              <div>
                <p className="text-sm font-medium">
                  {starts.setLocale("pt-BR").toFormat("dd/LL/yyyy HH:mm")} →{" "}
                  {ends.setLocale("pt-BR").toFormat("dd/LL/yyyy HH:mm")}
                </p>
                {b.reason && (
                  <p className="text-xs text-mi-texto/60">{b.reason}</p>
                )}
              </div>
              <form action={adminDeleteBlock.bind(null, b.id)}>
                <button className="rounded-mi border border-mi-cinza px-3 py-1.5 text-sm text-red-800">
                  Remover
                </button>
              </form>
            </div>
          );
        })}
      </div>
    </>
  );
}
