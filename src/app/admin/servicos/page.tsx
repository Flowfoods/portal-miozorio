import { prisma } from "@/lib/prisma";
import AdminNav from "@/components/admin/AdminNav";
import {
  adminUpdateService,
  adminCreateService,
  adminDeleteService,
} from "../actions";

export const dynamic = "force-dynamic";

const CATEGORY_LABEL: Record<string, string> = {
  social: "Social",
  sobrancelha: "Sobrancelha",
  curso: "Curso",
  noiva: "Noiva (vitrine)",
  debutante: "Debutante (vitrine)",
};

const centsToReais = (cents: number) =>
  (cents / 100).toFixed(2).replace(".", ",");

export default async function AdminServicosPage() {
  const services = await prisma.service.findMany({
    orderBy: [{ category: "asc" }, { name: "asc" }],
    include: {
      _count: { select: { bookings: true, eventSessions: true, waitlist: true } },
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
