import { getSettings } from "@/lib/settings";
import AdminNav from "@/components/admin/AdminNav";
import { adminSaveSettings } from "../actions";

export const dynamic = "force-dynamic";

const DAY_LABEL: [string, string][] = [
  ["mon", "Segunda"],
  ["tue", "Terça"],
  ["wed", "Quarta"],
  ["thu", "Quinta"],
  ["fri", "Sexta"],
  ["sat", "Sábado"],
  ["sun", "Domingo"],
];

const NUMERIC_FIELDS: { key: string; label: string; hint: string }[] = [
  { key: "buffer_min", label: "Intervalo entre clientes (min)", hint: "15" },
  { key: "min_lead_hours", label: "Antecedência mínima (horas)", hint: "24" },
  { key: "max_lead_days", label: "Agenda aberta até (dias)", hint: "90" },
  { key: "reminder_hours", label: "Lembrete antes (horas)", hint: "24" },
  {
    key: "cancel_window_days",
    label: "Prazo de cancelamento (dias)",
    hint: "3",
  },
  { key: "strike_limit", label: "Cancelamentos até exigir sinal", hint: "3" },
  { key: "hold_minutes", label: "Reserva do horário (min)", hint: "8" },
  { key: "slot_step_min", label: "Passo dos horários (min)", hint: "30" },
];

export default async function AdminConfigPage() {
  const s = await getSettings(true);

  const numericValue: Record<string, number> = {
    buffer_min: s.bufferMin,
    min_lead_hours: s.minLeadHours,
    max_lead_days: s.maxLeadDays,
    reminder_hours: s.reminderHours,
    cancel_window_days: s.cancelWindowDays,
    strike_limit: s.strikeLimit,
    hold_minutes: s.holdMinutes,
    slot_step_min: s.slotStepMin,
  };

  const dayValue = (day: string) =>
    (s.workingHours[day] ?? []).map(([a, b]) => `${a}-${b}`).join(", ");

  return (
    <>
      <AdminNav />
      <h1 className="mb-2 text-3xl">Configurações</h1>
      <p className="mb-6 text-sm text-mi-texto/70">
        Valem na hora para novos agendamentos — sem precisar de deploy.
      </p>

      <form action={adminSaveSettings} className="space-y-8">
        <section className="rounded-mi bg-mi-branco p-4 shadow-suave">
          <h2 className="mb-3 text-lg">Horário de atendimento</h2>
          <p className="mb-3 text-xs text-mi-texto/60">
            Formato 09:00-19:00 (vários períodos separados por vírgula). Vazio =
            fechado.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {DAY_LABEL.map(([day, label]) => (
              <label key={day} className="text-xs">
                {label}
                <input
                  className="input-mi mt-1 !py-2"
                  name={`wh_${day}`}
                  defaultValue={dayValue(day)}
                  placeholder="fechado"
                />
              </label>
            ))}
          </div>
        </section>

        <section className="rounded-mi bg-mi-branco p-4 shadow-suave">
          <h2 className="mb-3 text-lg">Regras da agenda</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {NUMERIC_FIELDS.map((f) => (
              <label key={f.key} className="text-xs">
                {f.label}
                <input
                  className="input-mi mt-1 !py-2"
                  name={f.key}
                  type="number"
                  min={0}
                  defaultValue={numericValue[f.key]}
                  placeholder={f.hint}
                  required
                />
              </label>
            ))}
          </div>
        </section>

        <button className="rounded-mi bg-mi-marrom px-6 py-3 text-white">
          Salvar configurações
        </button>
      </form>
    </>
  );
}
