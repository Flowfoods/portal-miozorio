import { prisma } from "@/lib/prisma";
import AdminNav from "@/components/admin/AdminNav";
import {
  adminUpdateService,
  adminCreateService,
  adminDeleteService,
  adminAddServiceAvailability,
  adminRemoveServiceAvailability,
} from "../actions";

export const dynamic = "force-dynamic";

const CATEGORY_LABEL: Record<string, string> = {
  social: "Social",
  sobrancelha: "Sobrancelha",
  cabelo: "Cabelo (dia a dia)",
  curso: "Curso",
  noiva: "Noiva (vitrine)",
  debutante: "Debutante (vitrine)",
};

const WD_LABEL: Record<number, string> = {
  1: "Seg",
  2: "Ter",
  3: "Qua",
  4: "Qui",
  5: "Sex",
  6: "Sáb",
  7: "Dom",
};

const centsToReais = (cents: number) =>
  (cents / 100).toFixed(2).replace(".", ",");

export default async function AdminServicosPage() {
  const services = await prisma.service.findMany({
    orderBy: [{ category: "asc" }, { name: "asc" }],
    include: {
      _count: { select: { bookings: true, eventSessions: true, waitlist: true } },
      availability: { orderBy: [{ weekday: "asc" }, { startTime: "asc" }] },
    },
  });

  return (
    <>
      <AdminNav />
      <h1 className="mb-2 text-3xl">Serviços</h1>
      <p className="mb-6 text-sm text-mi-texto/70">
        Preços em reais (ex.: 250,00). Duração e intervalo em minutos. Noiva e
        debutante nunca ficam agendáveis online — só vitrine com WhatsApp.
      </p>

      <details className="mb-6 rounded-mi bg-mi-branco p-4 shadow-suave">
        <summary className="cursor-pointer font-titulo text-lg text-mi-marrom-escuro">
          ＋ Novo serviço
        </summary>
        <form action={adminCreateService} className="mt-4 space-y-3">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <label className="text-xs sm:col-span-2">
              Nome
              <input
                className="input-mi mt-1 !py-2"
                name="name"
                placeholder="ex.: Maquiagem para formanda"
                required
              />
            </label>
            <label className="text-xs">
              Categoria
              <select className="input-mi mt-1 !py-2" name="category" required>
                <option value="social">Social</option>
                <option value="sobrancelha">Sobrancelha</option>
                <option value="cabelo">Cabelo (dia a dia)</option>
                <option value="curso">Curso</option>
                <option value="noiva">Noiva (vitrine)</option>
                <option value="debutante">Debutante (vitrine)</option>
              </select>
            </label>
            <label className="text-xs">
              Preço estúdio (R$)
              <input
                className="input-mi mt-1 !py-2"
                name="price"
                inputMode="decimal"
                placeholder="250,00"
                required
              />
            </label>
            <label className="text-xs">
              Preço domicílio (R$)
              <input
                className="input-mi mt-1 !py-2"
                name="priceHome"
                inputMode="decimal"
                placeholder="não atende"
              />
            </label>
            <label className="text-xs">
              Duração (min)
              <input
                className="input-mi mt-1 !py-2"
                name="durationMin"
                type="number"
                min={5}
                step={5}
                defaultValue={60}
                required
              />
            </label>
            <label className="text-xs">
              Intervalo (min)
              <input
                className="input-mi mt-1 !py-2"
                name="bufferMin"
                type="number"
                min={0}
                step={5}
                defaultValue={15}
              />
            </label>
          </div>
          <div className="flex flex-wrap items-center gap-4 text-sm">
            <label className="flex items-center gap-1.5">
              <input type="checkbox" name="bookableOnline" defaultChecked />
              Agendável online
            </label>
            <label className="flex items-center gap-1.5">
              <input type="checkbox" name="pendingPrice" />
              Preço a confirmar
            </label>
            <label className="flex items-center gap-1.5">
              <input type="checkbox" name="requiresDeposit" />
              Exige sinal
            </label>
            <button className="ml-auto rounded-mi bg-mi-marrom px-4 py-2 text-sm text-white">
              Criar serviço
            </button>
          </div>
        </form>
      </details>

      <div className="space-y-4">
        {services.map((s) => {
          const lockedOffline =
            s.category === "noiva" || s.category === "debutante";
          const deletable =
            s._count.bookings + s._count.eventSessions + s._count.waitlist ===
            0;
          return (
            <div key={s.id} className="rounded-mi bg-mi-branco p-4 shadow-suave">
            <form action={adminUpdateService}>
              <input type="hidden" name="id" value={s.id} />
              <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-lg">{s.name}</h2>
                <span className="text-xs text-mi-texto/60">
                  {CATEGORY_LABEL[s.category] ?? s.category} · {s.code}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <label className="text-xs">
                  Preço estúdio (R$)
                  <input
                    className="input-mi mt-1 !py-2"
                    name="price"
                    defaultValue={centsToReais(s.priceCents)}
                    inputMode="decimal"
                    required
                  />
                </label>
                <label className="text-xs">
                  Preço domicílio (R$)
                  <input
                    className="input-mi mt-1 !py-2"
                    name="priceHome"
                    defaultValue={
                      s.priceHomeCents != null
                        ? centsToReais(s.priceHomeCents)
                        : ""
                    }
                    inputMode="decimal"
                    placeholder="não atende"
                  />
                </label>
                <label className="text-xs">
                  Duração (min)
                  <input
                    className="input-mi mt-1 !py-2"
                    name="durationMin"
                    type="number"
                    min={5}
                    step={5}
                    defaultValue={s.durationMin}
                    required
                  />
                </label>
                <label className="text-xs">
                  Intervalo (min)
                  <input
                    className="input-mi mt-1 !py-2"
                    name="bufferMin"
                    type="number"
                    min={0}
                    step={5}
                    defaultValue={s.bufferMin}
                  />
                </label>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-4 text-sm">
                <label className="flex items-center gap-1.5">
                  <input type="checkbox" name="active" defaultChecked={s.active} />
                  Ativo
                </label>
                <label
                  className={`flex items-center gap-1.5 ${lockedOffline ? "opacity-50" : ""}`}
                >
                  <input
                    type="checkbox"
                    name="bookableOnline"
                    defaultChecked={s.bookableOnline}
                    disabled={lockedOffline}
                  />
                  Agendável online
                </label>
                <label className="flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    name="pendingPrice"
                    defaultChecked={s.pendingPrice}
                  />
                  Preço a confirmar
                </label>
                <label className="flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    name="requiresDeposit"
                    defaultChecked={s.requiresDeposit}
                  />
                  Exige sinal
                </label>
                <button className="ml-auto rounded-mi bg-mi-marrom px-4 py-2 text-sm text-white">
                  Salvar
                </button>
              </div>
            </form>

            {/* M9.5 — horários próprios do serviço (dia a dia) */}
            <details className="mt-3 border-t border-mi-cinza/60 pt-3">
              <summary className="cursor-pointer text-sm text-mi-marrom">
                Horários próprios ({s.availability.length}) ·{" "}
                {s.availability.length === 0
                  ? "usa o horário padrão"
                  : "agenda separada"}
              </summary>
              <p className="mt-2 text-xs text-mi-texto/60">
                Sem janelas, esse serviço segue o horário padrão do estúdio.
                Adicione janelas para dar dias/horas próprios (ex.: cabelo nos
                dias de semana).
              </p>
              {s.availability.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {s.availability.map((a) => (
                    <li
                      key={a.id}
                      className="flex items-center gap-3 text-sm"
                    >
                      <span className="min-w-32">
                        {WD_LABEL[a.weekday]} · {a.startTime}–{a.endTime}
                      </span>
                      <form
                        action={adminRemoveServiceAvailability.bind(null, a.id)}
                      >
                        <button className="text-xs text-red-800 underline-offset-2 hover:underline">
                          remover
                        </button>
                      </form>
                    </li>
                  ))}
                </ul>
              )}
              <form
                action={adminAddServiceAvailability}
                className="mt-3 flex flex-wrap items-end gap-2"
              >
                <input type="hidden" name="serviceId" value={s.id} />
                <label className="text-xs">
                  Dia
                  <select name="weekday" className="input-mi mt-1 !py-2">
                    {Object.entries(WD_LABEL).map(([n, l]) => (
                      <option key={n} value={n}>
                        {l}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-xs">
                  Início
                  <input
                    name="startTime"
                    placeholder="09:00"
                    className="input-mi mt-1 w-24 !py-2"
                  />
                </label>
                <label className="text-xs">
                  Fim
                  <input
                    name="endTime"
                    placeholder="18:00"
                    className="input-mi mt-1 w-24 !py-2"
                  />
                </label>
                <button className="rounded-mi border border-mi-cinza px-3 py-2 text-sm">
                  Adicionar janela
                </button>
              </form>
            </details>

            {deletable && (
              <form
                action={adminDeleteService.bind(null, s.id)}
                className="mt-2 text-right"
              >
                <button className="text-xs text-red-800 underline-offset-2 hover:underline">
                  Excluir serviço (sem histórico)
                </button>
              </form>
            )}
            </div>
          );
        })}
      </div>
    </>
  );
}
