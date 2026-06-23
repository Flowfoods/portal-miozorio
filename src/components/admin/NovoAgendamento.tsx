"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { maskPhoneBR, formatDuration } from "@/lib/format";
import { adminCreateManualBooking } from "@/app/admin/actions";

export interface AdminService {
  id: string;
  name: string;
  durationMin: number;
  bookableOnline: boolean;
  isCourse: boolean;
}

interface FoundCustomer {
  id: string;
  name: string;
  phoneE164: string;
  strikes: number;
}

type Source = "admin_phone" | "admin_whatsapp";

/**
 * Encaixe manual (M10.1) — tela única, pensada pra Mi criar em <40s pelo
 * celular quando a cliente liga/fecha no WhatsApp. Nasce confirmado.
 */
export default function NovoAgendamento({
  services,
  defaultDate,
}: {
  services: AdminService[];
  defaultDate: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const [serviceId, setServiceId] = useState(services[0]?.id ?? "");
  const [location, setLocation] = useState<"studio" | "home">("studio");
  const [date, setDate] = useState(defaultDate);
  const [source, setSource] = useState<Source>("admin_phone");

  // Horário: slots do motor + opção "fora do padrão" (valida só colisão).
  const [slots, setSlots] = useState<string[] | null>(null);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [time, setTime] = useState("");
  const [freeTime, setFreeTime] = useState(false);

  // Cliente: existente (selecionado) ou cadastro rápido.
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<FoundCustomer[]>([]);
  const [picked, setPicked] = useState<FoundCustomer | null>(null);
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");

  const [anamneseOpen, setAnamneseOpen] = useState(false);
  const [alergia, setAlergia] = useState("");
  const [referencia, setReferencia] = useState("");
  const [ocasiao, setOcasiao] = useState("");

  const [notify, setNotify] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const service = services.find((s) => s.id === serviceId) ?? null;

  // Busca de horários do motor (vazio p/ noiva/debutante → usa horário livre).
  useEffect(() => {
    if (!open || !serviceId || !date || freeTime) return;
    let alive = true;
    setSlotsLoading(true);
    setSlots(null);
    setTime("");
    fetch(`/api/availability?serviceId=${serviceId}&date=${date}&location=${location}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error())))
      .then((d: { slots: string[] }) => alive && setSlots(d.slots))
      .catch(() => alive && setSlots([]))
      .finally(() => alive && setSlotsLoading(false));
    return () => {
      alive = false;
    };
  }, [open, serviceId, date, location, freeTime]);

  // Busca de clientes (debounce simples).
  const debounce = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => {
    if (picked) return;
    if (debounce.current) clearTimeout(debounce.current);
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    debounce.current = setTimeout(() => {
      fetch(`/api/admin/customers?q=${encodeURIComponent(query.trim())}`)
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error())))
        .then((d: { customers: FoundCustomer[] }) => setResults(d.customers))
        .catch(() => setResults([]));
    }, 250);
    return () => debounce.current && clearTimeout(debounce.current);
  }, [query, picked]);

  const customerReady = picked
    ? true
    : newName.trim().length >= 2 && newPhone.replace(/\D/g, "").length >= 10;
  const canSubmit = !!service && !!date && time.length >= 4 && customerReady;

  async function submit() {
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    setError(null);
    const fd = new FormData();
    fd.set("serviceId", serviceId);
    fd.set("date", date);
    fd.set("time", time);
    fd.set("location", location);
    fd.set("source", source);
    fd.set("notify", notify ? "on" : "");
    if (picked) fd.set("customerId", picked.id);
    else {
      fd.set("customerName", newName.trim());
      fd.set("customerPhone", newPhone);
    }
    if (alergia.trim()) fd.set("alergia", alergia.trim());
    if (referencia.trim()) fd.set("referencia", referencia.trim());
    if (ocasiao.trim()) fd.set("ocasiao", ocasiao.trim());
    try {
      await adminCreateManualBooking(fd);
      // Sucesso: leva a Mi pro dia do agendamento e fecha o formulário.
      router.push(`/admin?data=${date}`);
      router.refresh();
      setOpen(false);
      resetForm();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Não consegui criar o agendamento.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  function resetForm() {
    setTime("");
    setFreeTime(false);
    setQuery("");
    setResults([]);
    setPicked(null);
    setNewName("");
    setNewPhone("");
    setAlergia("");
    setReferencia("");
    setOcasiao("");
    setAnamneseOpen(false);
    setError(null);
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="min-h-[44px] rounded-mi bg-mi-marrom px-4 text-sm text-white shadow-suave hover:bg-mi-marrom-escuro"
      >
        ＋ Novo agendamento
      </button>
    );
  }

  return (
    <div className="w-full rounded-mi border border-mi-cinza bg-mi-superficie-elevada shadow-suave">
      <div className="flex items-center justify-between border-b border-mi-cinza/60 px-4 py-3">
        <h2 className="font-titulo text-xl text-mi-marrom-escuro">
          Novo agendamento
        </h2>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            resetForm();
          }}
          className="text-sm text-mi-marrom underline-offset-2 hover:underline"
        >
          fechar
        </button>
      </div>

      {/* 2 zonas no desktop: formulário (esquerda) · horários do dia (direita) */}
      <div className="grid gap-6 p-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
        {/* ZONA ESQUERDA — formulário compacto */}
        <div className="space-y-4">
          {/* Serviço + local lado a lado */}
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
            <label className="block text-sm">
              <span className="text-mi-texto">Atendimento</span>
              <select
                value={serviceId}
                onChange={(e) => setServiceId(e.target.value)}
                className="input-mi mt-1 w-full"
              >
                {services.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} · {formatDuration(s.durationMin)}
                    {s.bookableOnline ? "" : " (combinado)"}
                  </option>
                ))}
              </select>
            </label>

            <div className="inline-flex h-[46px] items-center rounded-mi bg-mi-cinza p-1">
              {(["studio", "home"] as const).map((loc) => (
                <button
                  key={loc}
                  type="button"
                  onClick={() => setLocation(loc)}
                  className={`min-h-[38px] rounded-[10px] px-3 text-sm transition-colors ${
                    location === loc
                      ? "bg-mi-branco text-mi-marrom-escuro shadow-suave"
                      : "text-mi-marrom"
                  }`}
                >
                  {loc === "studio" ? "No estúdio" : "Em domicílio"}
                </button>
              ))}
            </div>
          </div>

          {/* Data */}
          <label className="block text-sm sm:max-w-[240px]">
            <span className="text-mi-texto">Dia</span>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="input-mi mt-1 w-full"
            />
          </label>

          {/* Cliente */}
          <div className="rounded-mi bg-mi-bege/50 p-3">
            <span className="text-sm font-medium text-mi-marrom-escuro">
              Cliente
            </span>
            {picked ? (
              <div className="mt-2 flex items-center justify-between gap-2">
                <span className="text-sm text-mi-texto">
                  {picked.name} · {picked.phoneE164}
                  {picked.strikes > 0 && (
                    <span className="text-red-800"> · ⚠ {picked.strikes}</span>
                  )}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setPicked(null);
                    setQuery("");
                  }}
                  className="text-xs text-mi-marrom underline-offset-2 hover:underline"
                >
                  trocar
                </button>
              </div>
            ) : (
              <>
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Buscar por nome ou telefone…"
                  className="input-mi mt-2 w-full"
                />
                {results.length > 0 && (
                  <ul className="mt-2 divide-y divide-mi-cinza rounded-mi border border-mi-cinza bg-mi-branco">
                    {results.map((c) => (
                      <li key={c.id}>
                        <button
                          type="button"
                          onClick={() => setPicked(c)}
                          className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-mi-cinza"
                        >
                          <span>{c.name}</span>
                          <span className="text-mi-texto/60">{c.phoneE164}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                <p className="mt-3 text-xs text-mi-texto/60">
                  Não achou? Cadastre rapidinho:
                </p>
                <div className="mt-1 grid gap-2 sm:grid-cols-2">
                  <input
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="Nome"
                    className="input-mi"
                  />
                  <input
                    value={newPhone}
                    inputMode="numeric"
                    onChange={(e) => setNewPhone(maskPhoneBR(e.target.value))}
                    placeholder="(21) 90000-0000"
                    className="input-mi"
                  />
                </div>
              </>
            )}
          </div>

          {/* Anamnese opcional */}
          <div>
            <button
              type="button"
              onClick={() => setAnamneseOpen((v) => !v)}
              className="text-sm text-mi-marrom underline-offset-2 hover:underline"
            >
              {anamneseOpen ? "− Esconder anamnese" : "＋ Anamnese (opcional)"}
            </button>
            {anamneseOpen && (
              <div className="mt-2 space-y-2">
                <label className="block text-sm">
                  <span className="font-medium text-mi-marrom-escuro">
                    Tem alguma alergia?
                  </span>
                  <textarea
                    value={alergia}
                    onChange={(e) => setAlergia(e.target.value)}
                    className="input-mi mt-1 min-h-[52px] w-full"
                    placeholder="Sensibilidades da pele"
                  />
                </label>
                <input
                  value={referencia}
                  onChange={(e) => setReferencia(e.target.value)}
                  placeholder="Referência / inspiração"
                  className="input-mi w-full text-sm"
                />
                <input
                  value={ocasiao}
                  onChange={(e) => setOcasiao(e.target.value)}
                  placeholder="Ocasião"
                  className="input-mi w-full text-sm"
                />
              </div>
            )}
          </div>

          {/* Origem + notificação */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="inline-flex rounded-mi bg-mi-cinza p-1 text-sm">
              {(
                [
                  ["admin_phone", "Ligou"],
                  ["admin_whatsapp", "WhatsApp"],
                ] as const
              ).map(([val, label]) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setSource(val)}
                  className={`min-h-[36px] rounded-[10px] px-3 transition-colors ${
                    source === val
                      ? "bg-mi-branco text-mi-marrom-escuro shadow-suave"
                      : "text-mi-marrom"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <label className="flex items-center gap-2 text-sm text-mi-texto">
              <input
                type="checkbox"
                checked={notify}
                onChange={(e) => setNotify(e.target.checked)}
                className="h-4 w-4 accent-mi-marrom"
              />
              Avisar no WhatsApp
            </label>
          </div>
          <p className="-mt-2 text-xs text-mi-texto/50">
            O aviso automático no WhatsApp entra junto com as automações (em
            breve).
          </p>
        </div>

        {/* ZONA DIREITA — horários do dia (aproveita a largura) */}
        <div className="rounded-mi bg-mi-superficie p-3 lg:p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm font-medium text-mi-marrom-escuro">
              Horário
            </span>
            <label className="flex items-center gap-2 text-xs text-mi-marrom">
              <input
                type="checkbox"
                checked={freeTime}
                onChange={(e) => {
                  setFreeTime(e.target.checked);
                  setTime("");
                }}
                className="h-4 w-4 accent-mi-marrom"
              />
              horário livre (fora do padrão)
            </label>
          </div>

          {freeTime ? (
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="input-mi mt-3 w-full sm:max-w-[200px]"
            />
          ) : (
            <div className="mt-3">
              {slotsLoading && (
                <span className="text-sm text-mi-texto/60">carregando…</span>
              )}
              {!slotsLoading && slots && slots.length === 0 && (
                <p className="rounded-mi border border-dashed border-mi-cinza bg-mi-superficie-elevada px-3 py-4 text-center text-sm text-mi-texto/70">
                  Sem horário no padrão neste dia.
                  <br />
                  Marque “horário livre” acima para encaixar.
                </p>
              )}
              {slots && slots.length > 0 && (
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {slots.map((hhmm) => (
                    <button
                      key={hhmm}
                      type="button"
                      onClick={() => setTime(hhmm)}
                      className={`min-h-[44px] rounded-mi border text-sm transition-colors ${
                        time === hhmm
                          ? "border-mi-marrom bg-mi-marrom text-white"
                          : "border-mi-cinza bg-mi-superficie-elevada text-mi-texto hover:border-mi-marrom"
                      }`}
                    >
                      {hhmm}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Rodapé sticky: erro + salvar sempre visível */}
      <div className="sticky bottom-0 flex flex-wrap items-center justify-end gap-3 rounded-b-mi border-t border-mi-cinza/60 bg-mi-superficie-elevada px-4 py-3">
        {error && (
          <p className="mr-auto text-sm text-red-700">{error}</p>
        )}
        <button
          type="button"
          disabled={!canSubmit || submitting}
          onClick={submit}
          className="min-h-[48px] w-full rounded-mi bg-mi-marrom px-6 text-sm text-white shadow-suave hover:bg-mi-marrom-escuro disabled:opacity-50 sm:w-auto"
        >
          {submitting ? "Salvando…" : "Criar agendamento"}
        </button>
      </div>
    </div>
  );
}
