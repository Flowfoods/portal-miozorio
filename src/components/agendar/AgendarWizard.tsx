"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  formatBRL,
  formatDuration,
  maskPhoneBR,
  formatDateLong,
} from "@/lib/format";

interface ApiService {
  id: string;
  code: string;
  name: string;
  category: string;
  durationMin: number;
  priceCents: number;
  priceHomeCents: number | null;
  pendingPrice: boolean;
  isCourse: boolean;
  /** Dias próprios (Luxon 1=seg..7=dom); null = regra padrão. M9.5. */
  availableWeekdays: number[] | null;
}

type Location = "studio" | "home";

const OCCASIONS = [
  "Casamento (madrinha/convidada)",
  "Formatura",
  "Aniversário",
  "Ensaio fotográfico",
  "Debutante",
  "Outro",
];

const STEPS = ["Serviço", "Data", "Horário", "Seus dados", "Confirmação"];

export default function AgendarWizard() {
  const [step, setStep] = useState(1);

  const [services, setServices] = useState<ApiService[] | null>(null);
  const [loadError, setLoadError] = useState(false);

  const [service, setService] = useState<ApiService | null>(null);
  const [location, setLocation] = useState<Location>("studio");

  const [date, setDate] = useState<string | null>(null);
  const [slots, setSlots] = useState<string[] | null>(null);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [time, setTime] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    allergy: "",
    reference: "",
    occasion: "",
    lgpd: false,
  });
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [booking, setBooking] = useState<{
    id: string;
    holdExpiresAt: string;
  } | null>(null);
  const [confirmed, setConfirmed] = useState(false);

  const search = useSearchParams();
  const preselectCode = search.get("servico");
  const preselectDone = useRef(false);

  useEffect(() => {
    fetch("/api/services")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error())))
      .then((d: { services: ApiService[] }) => setServices(d.services))
      .catch(() => setLoadError(true));
  }, []);

  // M9 — pré-seleção via /agendar?servico=<code> (vindo do catálogo Dia a Dia).
  // Aplica uma única vez, quando os serviços chegam.
  useEffect(() => {
    if (preselectDone.current || !services || !preselectCode) return;
    const found = services.find((s) => s.code === preselectCode);
    if (found) {
      setService(found);
      setStep(2);
    }
    preselectDone.current = true;
  }, [services, preselectCode]);

  const priceForLocation = (s: ApiService): number | null =>
    location === "home" ? s.priceHomeCents : s.priceCents;

  const validDates = useMemo(() => {
    if (!service) return [];
    const out: string[] = [];
    const now = new Date();
    const lead = new Date(now.getTime() + 24 * 3600 * 1000);
    for (let i = 0; i <= 90; i++) {
      const d = new Date(now);
      d.setDate(now.getDate() + i);
      d.setHours(12, 0, 0, 0);
      if (d < lead) continue;
      const dow = d.getDay(); // 0=dom ... 6=sáb
      const luxonWd = dow === 0 ? 7 : dow; // 1=seg..7=dom
      // M9.5: serviço com dias próprios respeita-os; senão, curso=qualquer dia,
      // demais=fim de semana (agenda social).
      const ok =
        service.availableWeekdays && service.availableWeekdays.length
          ? service.availableWeekdays.includes(luxonWd)
          : service.isCourse
            ? true
            : dow === 0 || dow === 6;
      if (ok) out.push(d.toISOString().slice(0, 10));
    }
    return out;
  }, [service]);

  useEffect(() => {
    if (!service || !date) return;
    setSlotsLoading(true);
    setSlots(null);
    setTime(null);
    fetch(
      `/api/availability?serviceId=${service.id}&date=${date}&location=${location}`,
    )
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error())))
      .then((d: { slots: string[] }) => setSlots(d.slots))
      .catch(() => setSlots([]))
      .finally(() => setSlotsLoading(false));
  }, [service, date, location]);

  const canSubmit =
    form.name.trim().length >= 2 &&
    form.phone.replace(/\D/g, "").length >= 10 &&
    form.occasion.length > 0 &&
    form.lgpd;

  async function submitBooking() {
    if (!service || !date || !time) return;
    setSubmitting(true);
    setFormError(null);
    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serviceId: service.id,
          date,
          time,
          location,
          customer: {
            name: form.name.trim(),
            phone: form.phone,
            email: form.email.trim() || undefined,
          },
          anamnesis: {
            alergia: form.allergy.trim(),
            referencia: form.reference.trim(),
            ocasiao: form.occasion,
          },
          lgpdConsent: form.lgpd,
        }),
      });
      if (res.status === 409) {
        setFormError("Esse horário acabou de ser reservado 😔 Escolha outro?");
        setTime(null);
        setSlots(null);
        setStep(3);
        // re-dispara o fetch de slots
        const d = date;
        setDate(null);
        setTimeout(() => setDate(d), 0);
        return;
      }
      if (!res.ok) {
        const e = (await res.json().catch(() => ({}))) as { error?: string };
        setFormError(e.error ?? "Não consegui criar seu agendamento. Tenta de novo?");
        return;
      }
      const data = (await res.json()) as { id: string; holdExpiresAt: string };
      setBooking(data);
      setStep(5);
    } catch {
      setFormError("Tivemos um probleminha de conexão. Tenta de novo, tá?");
    } finally {
      setSubmitting(false);
    }
  }

  async function confirmBooking() {
    if (!booking) return;
    setSubmitting(true);
    setFormError(null);
    try {
      const res = await fetch(`/api/bookings/${booking.id}/confirm`, {
        method: "POST",
      });
      if (res.ok) {
        setConfirmed(true);
        return;
      }
      const e = (await res.json().catch(() => ({}))) as {
        error?: string;
        code?: string;
      };
      setFormError(e.error ?? "Não consegui confirmar.");
    } catch {
      setFormError("Tivemos um probleminha de conexão. Tenta de novo?");
    } finally {
      setSubmitting(false);
    }
  }

  if (confirmed && service && date && time) {
    return <SuccessScreen service={service} date={date} time={time} />;
  }

  return (
    <div className="mx-auto w-full max-w-lg px-5 py-8">
      <Stepper step={step} />

      {/* STEP 1 — Serviço */}
      {step === 1 && (
        <section className="mt-8">
          <h2 className="font-titulo text-3xl text-mi-marrom-escuro">
            Qual atendimento você quer?
          </h2>

          <div className="mt-5 inline-flex rounded-mi bg-mi-cinza p-1">
            {(["studio", "home"] as Location[]).map((loc) => (
              <button
                key={loc}
                onClick={() => setLocation(loc)}
                className={`min-h-[40px] rounded-[10px] px-5 font-corpo text-sm transition-colors ${
                  location === loc
                    ? "bg-mi-branco text-mi-marrom-escuro shadow-suave"
                    : "text-mi-marrom"
                }`}
              >
                {loc === "studio" ? "No estúdio" : "Em domicílio"}
              </button>
            ))}
          </div>
          {location === "home" && (
            <p className="mt-2 font-corpo text-xs text-mi-marrom">
              O atendimento em domicílio inclui a taxa de deslocamento 💛
            </p>
          )}

          {loadError && (
            <p className="mt-8 font-corpo text-mi-texto">
              Poxa, não consegui carregar os serviços agora. Recarrega a página?
            </p>
          )}
          {!services && !loadError && <CardsSkeleton />}

          <div className="mt-6 space-y-3">
            {services?.map((s) => {
              const price = priceForLocation(s);
              const unavailableHome = location === "home" && s.priceHomeCents === null;
              return (
                <button
                  key={s.id}
                  disabled={unavailableHome}
                  onClick={() => {
                    setService(s);
                    setDate(null);
                    setSlots(null);
                    setStep(2);
                  }}
                  className="flex w-full items-center justify-between gap-4 rounded-mi border border-mi-cinza bg-mi-branco p-4 text-left shadow-suave transition-colors hover:border-mi-marrom disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <span>
                    <span className="block font-titulo text-lg text-mi-marrom-escuro">
                      {s.name}
                    </span>
                    <span className="font-corpo text-sm text-mi-marrom">
                      {formatDuration(s.durationMin)}
                      {unavailableHome ? " · só no estúdio" : ""}
                    </span>
                  </span>
                  <span className="shrink-0 font-corpo text-base font-medium text-mi-marrom-escuro">
                    {s.pendingPrice || price === null
                      ? "sob consulta"
                      : formatBRL(price)}
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* STEP 2 — Data */}
      {step === 2 && service && (
        <section className="mt-8">
          <BackButton onClick={() => setStep(1)} />
          <h2 className="mt-3 font-titulo text-3xl text-mi-marrom-escuro">
            Escolha o dia
          </h2>
          <p className="mt-1 font-corpo text-sm text-mi-marrom">
            {service.isCourse
              ? "O curso pode ser em qualquer dia 💛"
              : "Atendimentos aos sábados e domingos 💛"}
          </p>

          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {validDates.slice(0, 18).map((d) => (
              <button
                key={d}
                onClick={() => {
                  setDate(d);
                  setStep(3);
                }}
                className="min-h-[56px] rounded-mi border border-mi-cinza bg-mi-branco px-3 py-2 font-corpo text-sm capitalize text-mi-texto shadow-suave transition-colors hover:border-mi-marrom"
              >
                {new Date(`${d}T12:00:00`).toLocaleDateString("pt-BR", {
                  weekday: "short",
                  day: "2-digit",
                  month: "short",
                })}
              </button>
            ))}
          </div>
        </section>
      )}

      {/* STEP 3 — Horário */}
      {step === 3 && service && date && (
        <section className="mt-8">
          <BackButton onClick={() => setStep(2)} />
          <h2 className="mt-3 font-titulo text-3xl text-mi-marrom-escuro">
            Que horas fica bom?
          </h2>
          <p className="mt-1 font-corpo text-sm capitalize text-mi-marrom">
            {formatDateLong(date)}
          </p>

          {slotsLoading && <ChipsSkeleton />}
          {!slotsLoading && slots && slots.length === 0 && (
            <p className="mt-6 font-corpo text-mi-texto">
              Poxa, esse dia já está cheio… que tal escolher outra data? 💛
            </p>
          )}
          <div className="mt-6 flex flex-wrap gap-2">
            {slots?.map((hhmm) => (
              <button
                key={hhmm}
                onClick={() => {
                  setTime(hhmm);
                  setStep(4);
                }}
                className="min-h-[48px] rounded-mi border border-mi-cinza bg-mi-branco px-5 font-corpo text-mi-texto shadow-suave transition-colors hover:border-mi-marrom"
              >
                {hhmm}
              </button>
            ))}
          </div>
        </section>
      )}

      {/* STEP 4 — Seus dados + anamnese */}
      {step === 4 && service && (
        <section className="mt-8">
          <BackButton onClick={() => setStep(3)} />
          <h2 className="mt-3 font-titulo text-3xl text-mi-marrom-escuro">
            Seus dados
          </h2>

          <div className="mt-6 space-y-4">
            <Field label="Seu nome">
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="input-mi"
                placeholder="Como você gosta de ser chamada"
              />
            </Field>
            <Field label="WhatsApp">
              <input
                value={form.phone}
                inputMode="numeric"
                onChange={(e) =>
                  setForm({ ...form, phone: maskPhoneBR(e.target.value) })
                }
                className="input-mi"
                placeholder="(21) 90000-0000"
              />
            </Field>
            <Field label="E-mail (opcional)">
              <input
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="input-mi"
                placeholder="seu@email.com"
              />
            </Field>

            <Field label="Tem alguma alergia?" highlight>
              <textarea
                value={form.allergy}
                onChange={(e) => setForm({ ...form, allergy: e.target.value })}
                className="input-mi min-h-[64px]"
                placeholder="Conte aqui qualquer sensibilidade da sua pele 💛"
              />
            </Field>
            <Field label="Já tem referência do que quer?">
              <textarea
                value={form.reference}
                onChange={(e) =>
                  setForm({ ...form, reference: e.target.value })
                }
                className="input-mi min-h-[64px]"
                placeholder="Descreva ou conte que vai levar fotos de inspiração"
              />
            </Field>
            <Field label="Qual a ocasião?">
              <select
                value={form.occasion}
                onChange={(e) =>
                  setForm({ ...form, occasion: e.target.value })
                }
                className="input-mi"
              >
                <option value="">Selecione…</option>
                {OCCASIONS.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            </Field>

            <label className="flex items-start gap-3 font-corpo text-sm text-mi-texto">
              <input
                type="checkbox"
                checked={form.lgpd}
                onChange={(e) => setForm({ ...form, lgpd: e.target.checked })}
                className="mt-1 h-5 w-5 accent-mi-marrom"
              />
              <span>
                Li e aceito a{" "}
                <a href="/privacidade" className="underline" target="_blank">
                  política de privacidade
                </a>
                . Seus dados são tratados com cuidado e sigilo 💛
              </span>
            </label>

            {formError && (
              <p className="font-corpo text-sm text-red-700">{formError}</p>
            )}

            <button
              disabled={!canSubmit || submitting}
              onClick={submitBooking}
              className="min-h-[52px] w-full rounded-mi bg-mi-marrom font-corpo text-base text-mi-branco shadow-suave transition-colors hover:bg-mi-marrom-escuro disabled:cursor-not-allowed disabled:opacity-40"
            >
              {submitting ? "Reservando…" : "Continuar"}
            </button>
          </div>
        </section>
      )}

      {/* STEP 5 — Confirmação */}
      {step === 5 && service && date && time && booking && (
        <section className="mt-8">
          <h2 className="font-titulo text-3xl text-mi-marrom-escuro">
            Quase lá!
          </h2>
          <p className="mt-1 font-corpo text-sm text-mi-marrom">
            Confirme os detalhes do seu horário 💛
          </p>

          <dl className="mt-6 space-y-3 rounded-mi border border-mi-cinza bg-mi-branco p-5 shadow-suave">
            <Row label="Atendimento" value={service.name} />
            <Row
              label="Local"
              value={location === "home" ? "Em domicílio" : "No estúdio"}
            />
            <Row label="Dia" value={formatDateLong(date)} />
            <Row label="Horário" value={time} />
            <Row label="Nome" value={form.name} />
          </dl>

          <HoldCountdown
            holdExpiresAt={booking.holdExpiresAt}
            onExpire={() => {
              setFormError("O tempo da reserva expirou. Vamos escolher de novo? 💛");
              setBooking(null);
              setConfirmed(false);
              setStep(3);
            }}
          />

          {formError && (
            <p className="mt-3 font-corpo text-sm text-red-700">{formError}</p>
          )}

          <button
            disabled={submitting}
            onClick={confirmBooking}
            className="mt-6 min-h-[52px] w-full rounded-mi bg-mi-marrom font-corpo text-base text-mi-branco shadow-suave transition-colors hover:bg-mi-marrom-escuro disabled:opacity-40"
          >
            {submitting ? "Confirmando…" : "Confirmar meu horário"}
          </button>
        </section>
      )}
    </div>
  );
}

function Stepper({ step }: { step: number }) {
  return (
    <ol className="flex items-center gap-1.5">
      {STEPS.map((label, i) => {
        const n = i + 1;
        const done = n <= step;
        return (
          <li key={label} className="flex flex-1 flex-col items-center gap-1.5">
            <span
              className={`h-1.5 w-full rounded-full ${
                done ? "bg-mi-marrom" : "bg-mi-cinza"
              }`}
            />
            <span
              className={`font-corpo text-[10px] ${
                done ? "text-mi-marrom-escuro" : "text-mi-marrom/60"
              }`}
            >
              {label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="font-corpo text-sm text-mi-marrom">{label}</dt>
      <dd className="text-right font-corpo text-mi-texto">{value}</dd>
    </div>
  );
}

function Field({
  label,
  highlight,
  children,
}: {
  label: string;
  highlight?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span
        className={`mb-1.5 block font-corpo text-sm ${
          highlight ? "font-medium text-mi-marrom-escuro" : "text-mi-marrom"
        }`}
      >
        {label}
      </span>
      {children}
    </label>
  );
}

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="font-corpo text-sm text-mi-marrom transition-colors hover:text-mi-marrom-escuro"
    >
      ‹ voltar
    </button>
  );
}

function CardsSkeleton() {
  return (
    <div className="mt-6 space-y-3">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="h-[72px] animate-pulse rounded-mi border border-mi-cinza bg-mi-cinza/40"
        />
      ))}
    </div>
  );
}

function ChipsSkeleton() {
  return (
    <div className="mt-6 flex flex-wrap gap-2">
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <div
          key={i}
          className="h-[48px] w-20 animate-pulse rounded-mi bg-mi-cinza/40"
        />
      ))}
    </div>
  );
}

function HoldCountdown({
  holdExpiresAt,
  onExpire,
}: {
  holdExpiresAt: string;
  onExpire: () => void;
}) {
  const [left, setLeft] = useState(() =>
    Math.max(0, Math.floor((new Date(holdExpiresAt).getTime() - Date.now()) / 1000)),
  );
  useEffect(() => {
    const t = setInterval(() => {
      const s = Math.max(
        0,
        Math.floor((new Date(holdExpiresAt).getTime() - Date.now()) / 1000),
      );
      setLeft(s);
      if (s <= 0) {
        clearInterval(t);
        onExpire();
      }
    }, 1000);
    return () => clearInterval(t);
  }, [holdExpiresAt, onExpire]);

  const mm = Math.floor(left / 60);
  const ss = (left % 60).toString().padStart(2, "0");
  return (
    <p className="mt-4 text-center font-corpo text-sm text-mi-marrom">
      Reservamos esse horário pra você por mais{" "}
      <span className="font-medium text-mi-marrom-escuro">
        {mm}:{ss}
      </span>
    </p>
  );
}

function SuccessScreen({
  service,
  date,
  time,
}: {
  service: ApiService;
  date: string;
  time: string;
}) {
  return (
    <div className="mx-auto flex min-h-[70vh] max-w-lg flex-col items-center justify-center px-6 py-12 text-center">
      <p className="font-corpo text-xs uppercase tracking-[0.3em] text-mi-marrom">
        Agendamento confirmado
      </p>
      <h1 className="mt-5 font-titulo text-4xl text-mi-marrom-escuro">
        Que alegria! 💛
      </h1>
      <p className="mt-4 font-corpo text-mi-texto">
        Seu horário de <strong>{service.name}</strong> está reservado para{" "}
        <span className="capitalize">{formatDateLong(date)}</span> às{" "}
        <strong>{time}</strong>.
      </p>
      <p className="mt-3 font-corpo text-sm text-mi-marrom">
        Você vai receber a confirmação no WhatsApp 💛 Lembre de levar referências
        do que deseja!
      </p>
      <a
        href="/"
        className="mt-8 inline-flex min-h-[48px] items-center justify-center rounded-mi bg-mi-marrom px-8 font-corpo text-mi-branco shadow-suave transition-colors hover:bg-mi-marrom-escuro"
      >
        Voltar ao início
      </a>
    </div>
  );
}
