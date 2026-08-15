"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { maskPhoneBR, formatDuration, formatBRL } from "@/lib/format";
import {
  adminCreateManualBooking,
  adminQuickCreateCustomer,
  previewBookingMessage,
} from "@/app/admin/actions";

export interface AdminService {
  id: string;
  name: string;
  durationMin: number;
  priceCents: number;
  priceHomeCents: number | null;
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

/** Item do agendamento (multi-serviço). preço em reais (string editável). */
interface Item {
  serviceId: string;
  precoReais: string;
  motivo: string;
}

function centsToReais(cents: number): string {
  return (cents / 100).toFixed(2).replace(".", ",");
}
function reaisToCents(s: string): number {
  const clean = s.replace(/[^\d,]/g, "").replace(",", ".");
  const v = parseFloat(clean);
  return Number.isFinite(v) ? Math.round(v * 100) : 0;
}

/**
 * Encaixe manual (M10.1 + multi-serviço) — tela única, pensada pra Mi criar em
 * <40s. Nasce confirmado. Vários serviços por atendimento, cada um com valor
 * sugerido do catálogo e editável por particularidade + motivo do ajuste.
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

  const priceFor = (svc: AdminService | undefined, loc: "studio" | "home") =>
    !svc
      ? 0
      : loc === "home" && svc.priceHomeCents != null
        ? svc.priceHomeCents
        : svc.priceCents;

  const [location, setLocation] = useState<"studio" | "home">("studio");
  const [items, setItems] = useState<Item[]>([
    {
      serviceId: services[0]?.id ?? "",
      precoReais: centsToReais(priceFor(services[0], "studio")),
      motivo: "",
    },
  ]);
  const [date, setDate] = useState(defaultDate);
  const [source, setSource] = useState<Source>("admin_phone");

  // Horário: slots do motor (pela duração TOTAL) + "fora do padrão".
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
  const [creatingCustomer, setCreatingCustomer] = useState(false);

  const [anamneseOpen, setAnamneseOpen] = useState(false);
  const [alergia, setAlergia] = useState("");
  const [referencia, setReferencia] = useState("");
  const [ocasiao, setOcasiao] = useState("");

  // Foto de referência (opcional, LGPD): só vai junto com consentimento.
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState("");
  const [photoConsent, setPhotoConsent] = useState(false);

  const [notify, setNotify] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Preview da mensagem (feature 5): modal de confirmação antes de criar.
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [previewText, setPreviewText] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const svcById = new Map(services.map((s) => [s.id, s]));
  const primaryId = items[0]?.serviceId ?? "";
  const totalDuration = items.reduce(
    (sum, it) => sum + (svcById.get(it.serviceId)?.durationMin ?? 0),
    0,
  );
  const totalCents = items.reduce((sum, it) => sum + reaisToCents(it.precoReais), 0);

  // Atualiza um item; ao trocar o serviço, sugere o preço do catálogo.
  function setItem(idx: number, patch: Partial<Item>) {
    setItems((prev) =>
      prev.map((it, i) => {
        if (i !== idx) return it;
        const next = { ...it, ...patch };
        if (patch.serviceId !== undefined) {
          next.precoReais = centsToReais(
            priceFor(svcById.get(patch.serviceId), location),
          );
        }
        return next;
      }),
    );
  }
  function addItem() {
    const s = services[0];
    setItems((prev) => [
      ...prev,
      {
        serviceId: s?.id ?? "",
        precoReais: centsToReais(priceFor(s, location)),
        motivo: "",
      },
    ]);
  }
  function removeItem(idx: number) {
    setItems((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== idx)));
  }

  // Busca de horários do motor pela duração TOTAL (vazio → use horário livre).
  useEffect(() => {
    if (!open || !primaryId || !date || freeTime || totalDuration <= 0) return;
    let alive = true;
    setSlotsLoading(true);
    setSlots(null);
    setTime("");
    fetch(
      `/api/availability?serviceId=${primaryId}&date=${date}&location=${location}&durationMin=${totalDuration}`,
    )
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error())))
      .then((d: { slots: string[] }) => alive && setSlots(d.slots))
      .catch(() => alive && setSlots([]))
      .finally(() => alive && setSlotsLoading(false));
    return () => {
      alive = false;
    };
  }, [open, primaryId, date, location, freeTime, totalDuration]);

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

  const newCustomerReady =
    newName.trim().length >= 2 && newPhone.replace(/\D/g, "").length >= 10;
  const customerReady = picked ? true : newCustomerReady;
  const itemsReady = items.length > 0 && items.every((it) => it.serviceId);
  const photoOk = !photoFile || photoConsent; // foto exige consentimento
  const canSubmit =
    itemsReady && !!date && time.length >= 4 && customerReady && photoOk;

  const servicoNames = items
    .map((it) => svcById.get(it.serviceId)?.name)
    .filter(Boolean)
    .join(" + ");
  const clienteNome = (picked?.name ?? newName).trim();

  async function handleCreateCustomer() {
    if (!newCustomerReady || creatingCustomer) return;
    setCreatingCustomer(true);
    setError(null);
    try {
      const r = await adminQuickCreateCustomer(newName, newPhone);
      if (!r.ok) {
        setError(r.message);
        return;
      }
      setPicked(r.customer);
      setQuery("");
      setResults([]);
      setNewName("");
      setNewPhone("");
    } catch {
      setError("Não consegui cadastrar a cliente.");
    } finally {
      setCreatingCustomer(false);
    }
  }

  function onPickPhoto(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setPhotoFile(f);
    setPhotoConsent(false);
    setPhotoPreview(f ? URL.createObjectURL(f) : "");
  }
  function removePhoto() {
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setPhotoFile(null);
    setPhotoConsent(false);
    setPhotoPreview("");
  }

  // Abre o preview da mensagem (mesma do envio real) antes de criar.
  async function openConfirm() {
    if (!canSubmit || submitting) return;
    setError(null);
    setConfirmOpen(true);
    if (!notify) {
      setPreviewText(null);
      return;
    }
    setPreviewLoading(true);
    try {
      const txt = await previewBookingMessage({
        nome: clienteNome,
        servico: servicoNames,
        date,
        time,
      });
      setPreviewText(txt);
    } catch {
      setPreviewText(null);
    } finally {
      setPreviewLoading(false);
    }
  }

  async function submit() {
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    setError(null);
    const fd = new FormData();
    if (photoFile) {
      fd.set("photo", photoFile);
      fd.set("photoConsent", photoConsent ? "on" : "");
    }
    fd.set(
      "items",
      JSON.stringify(
        items.map((it) => ({
          serviceId: it.serviceId,
          precoCobradoCents: reaisToCents(it.precoReais),
          motivoAjuste: it.motivo.trim() || undefined,
        })),
      ),
    );
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
      const r = await adminCreateManualBooking(fd);
      if (!r.ok) {
        setError(r.message);
        return;
      }
      router.push(`/admin?data=${date}`);
      router.refresh();
      setOpen(false);
      resetForm();
    } catch {
      setError("Não consegui criar o agendamento. Tente de novo.");
    } finally {
      setSubmitting(false);
    }
  }

  function resetForm() {
    setItems([
      {
        serviceId: services[0]?.id ?? "",
        precoReais: centsToReais(priceFor(services[0], "studio")),
        motivo: "",
      },
    ]);
    setLocation("studio");
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
    removePhoto();
    setConfirmOpen(false);
    setPreviewText(null);
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
          className="text-sm text-mi-marrom-escuro underline-offset-2 hover:underline"
        >
          fechar
        </button>
      </div>

      {/* 2 zonas no desktop: formulário (esquerda) · horários do dia (direita) */}
      <div className="grid gap-6 p-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
        {/* ZONA ESQUERDA — formulário compacto */}
        <div className="space-y-4">
          {/* Local */}
          <div className="inline-flex rounded-mi bg-mi-cinza p-1">
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

          {/* Serviços (multi) */}
          <div className="space-y-3">
            <span className="text-sm font-medium text-mi-marrom-escuro">
              Serviços
            </span>
            {items.map((it, idx) => {
              const svc = svcById.get(it.serviceId);
              const tabela = priceFor(svc, location);
              const cobrado = reaisToCents(it.precoReais);
              const ajustado = svc != null && cobrado !== tabela;
              return (
                <div
                  key={idx}
                  className="rounded-mi border border-mi-cinza bg-mi-superficie p-3"
                >
                  <div className="flex items-start gap-2">
                    <select
                      value={it.serviceId}
                      onChange={(e) => setItem(idx, { serviceId: e.target.value })}
                      className="input-mi w-full"
                    >
                      {services.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name} · {formatDuration(s.durationMin)}
                          {s.bookableOnline ? "" : " (combinado)"}
                        </option>
                      ))}
                    </select>
                    {items.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeItem(idx)}
                        aria-label="Remover serviço"
                        className="mt-1 shrink-0 text-mi-marrom hover:text-mi-marrom-escuro"
                      >
                        remover
                      </button>
                    )}
                  </div>
                  <div className="mt-2 grid gap-2 sm:grid-cols-[160px_minmax(0,1fr)]">
                    <label className="block text-xs text-mi-texto">
                      Valor (R$)
                      <input
                        value={it.precoReais}
                        inputMode="decimal"
                        onChange={(e) => setItem(idx, { precoReais: e.target.value })}
                        className="input-mi mt-1 w-full !py-2"
                      />
                    </label>
                    <label className="block text-xs text-mi-texto">
                      Motivo do ajuste (opcional)
                      <input
                        value={it.motivo}
                        onChange={(e) => setItem(idx, { motivo: e.target.value })}
                        placeholder="ex.: cabelo longo, desconto"
                        className="input-mi mt-1 w-full !py-2"
                      />
                    </label>
                  </div>
                  {ajustado && (
                    <p className="mt-1 text-[11px] text-mi-marrom-escuro">
                      Tabela: {formatBRL(tabela)} · cobrado {formatBRL(cobrado)}
                    </p>
                  )}
                </div>
              );
            })}
            <button
              type="button"
              onClick={addItem}
              className="text-sm text-mi-marrom-escuro underline-offset-2 hover:underline"
            >
              ＋ Adicionar serviço
            </button>
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
                  className="text-xs text-mi-marrom-escuro underline-offset-2 hover:underline"
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
                          <span className="text-mi-texto/80">{c.phoneE164}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                <p className="mt-3 text-xs text-mi-texto/80">
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
                <button
                  type="button"
                  disabled={!newCustomerReady || creatingCustomer}
                  onClick={handleCreateCustomer}
                  className="mt-2 min-h-[40px] w-full rounded-mi border border-mi-marrom px-4 text-sm text-mi-marrom-escuro transition-colors hover:bg-mi-cinza/50 disabled:opacity-50"
                >
                  {creatingCustomer ? "Cadastrando…" : "Cadastrar cliente"}
                </button>
              </>
            )}
          </div>

          {/* Anamnese opcional */}
          <div>
            <button
              type="button"
              onClick={() => setAnamneseOpen((v) => !v)}
              className="text-sm text-mi-marrom-escuro underline-offset-2 hover:underline"
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
                  className="input-mi w-full"
                />
                <input
                  value={ocasiao}
                  onChange={(e) => setOcasiao(e.target.value)}
                  placeholder="Ocasião"
                  className="input-mi w-full"
                />
              </div>
            )}
          </div>

          {/* Foto de referência (opcional, LGPD) */}
          <div className="rounded-mi border border-mi-cinza bg-mi-superficie p-3">
            <span className="text-sm font-medium text-mi-marrom-escuro">
              Foto de referência{" "}
              <span className="font-normal text-mi-texto/80">(opcional)</span>
            </span>
            {photoPreview ? (
              <div className="mt-2 flex items-start gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photoPreview}
                  alt="Pré-visualização da foto"
                  className="h-20 w-20 rounded-mi object-cover"
                />
                <div className="flex-1">
                  <button
                    type="button"
                    onClick={removePhoto}
                    className="text-xs text-mi-marrom-escuro underline-offset-2 hover:underline"
                  >
                    remover foto
                  </button>
                  <label className="mt-2 flex items-start gap-2 text-xs text-mi-texto">
                    <input
                      type="checkbox"
                      checked={photoConsent}
                      onChange={(e) => setPhotoConsent(e.target.checked)}
                      className="mt-0.5 h-4 w-4 accent-mi-marrom"
                    />
                    A cliente autorizou o registro da imagem (referência do
                    atendimento).
                  </label>
                </div>
              </div>
            ) : (
              <label className="mt-2 flex min-h-[44px] cursor-pointer items-center justify-center rounded-mi border border-dashed border-mi-cinza bg-mi-superficie-elevada px-3 text-sm text-mi-marrom-escuro hover:border-mi-marrom">
                Anexar foto (JPG/PNG/WebP, até 5MB)
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={onPickPhoto}
                  className="hidden"
                />
              </label>
            )}
            <p className="mt-2 text-[11px] text-mi-texto/80">
              Guardada em local privado, só você vê. Pode remover depois.
            </p>
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
          <p className="-mt-2 text-xs text-mi-texto/80">
            O aviso automático no WhatsApp entra junto com as automações (em
            breve).
          </p>
        </div>

        {/* ZONA DIREITA — horários do dia + resumo */}
        <div className="rounded-mi bg-mi-superficie p-3 lg:p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm font-medium text-mi-marrom-escuro">
              Horário
            </span>
            <label className="flex items-center gap-2 text-xs text-mi-marrom-escuro">
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
                <span className="text-sm text-mi-texto/80">carregando…</span>
              )}
              {!slotsLoading && slots && slots.length === 0 && (
                <p className="rounded-mi border border-dashed border-mi-cinza bg-mi-superficie-elevada px-3 py-4 text-center text-sm text-mi-texto/80">
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

          {/* Resumo */}
          <dl className="mt-4 space-y-1 border-t border-mi-cinza/60 pt-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-mi-texto/80">Dia / horário</dt>
              <dd className="text-mi-marrom-escuro">
                {date
                  ? new Date(`${date}T00:00`).toLocaleDateString("pt-BR")
                  : "—"}
                {time ? ` às ${time}` : ""}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-mi-texto/80">Duração total</dt>
              <dd className="text-mi-marrom-escuro">
                {totalDuration > 0 ? formatDuration(totalDuration) : "—"}
              </dd>
            </div>
            <div className="flex justify-between font-medium">
              <dt className="text-mi-texto/80">Valor total</dt>
              <dd className="text-mi-marrom-escuro">{formatBRL(totalCents)}</dd>
            </div>
          </dl>
        </div>
      </div>

      {/* Rodapé sticky: erro + salvar sempre visível */}
      <div className="sticky bottom-0 flex flex-wrap items-center justify-end gap-3 rounded-b-mi border-t border-mi-cinza/60 bg-mi-superficie-elevada px-4 py-3">
        {error && <p className="mr-auto text-sm text-red-700">{error}</p>}
        <button
          type="button"
          disabled={!canSubmit || submitting}
          onClick={openConfirm}
          className="min-h-[48px] w-full rounded-mi bg-mi-marrom px-6 text-sm text-white shadow-suave hover:bg-mi-marrom-escuro disabled:opacity-50 sm:w-auto"
        >
          Revisar e criar
        </button>
      </div>

      {/* Preview da mensagem + confirmação (feature 5) */}
      {confirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            onClick={() => !submitting && setConfirmOpen(false)}
            aria-hidden="true"
            className="absolute inset-0 bg-mi-marrom-escuro/40 backdrop-blur-sm"
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Confirmar agendamento"
            className="relative w-full max-w-md rounded-mi bg-mi-superficie-elevada p-5 shadow-suave"
          >
            <h3 className="font-titulo text-xl text-mi-marrom-escuro">
              Confirmar agendamento
            </h3>
            <p className="mt-1 text-sm text-mi-texto/80">
              {servicoNames} · {date ? new Date(`${date}T00:00`).toLocaleDateString("pt-BR") : ""}
              {time ? ` às ${time}` : ""}
            </p>

            {notify ? (
              <div className="mt-4">
                <p className="text-xs font-medium uppercase tracking-wide text-mi-marrom-escuro">
                  Mensagem que será enviada no WhatsApp
                </p>
                <div className="mt-1 max-h-48 overflow-y-auto whitespace-pre-wrap rounded-mi border border-mi-cinza bg-mi-superficie p-3 text-sm text-mi-texto">
                  {previewLoading
                    ? "carregando…"
                    : (previewText ?? "(mensagem indisponível)")}
                </div>
              </div>
            ) : (
              <p className="mt-4 rounded-mi border border-dashed border-mi-cinza bg-mi-superficie p-3 text-sm text-mi-texto/80">
                “Avisar no WhatsApp” está desligado — nenhuma mensagem será
                enviada à cliente.
              </p>
            )}

            {error && <p className="mt-3 text-sm text-red-700">{error}</p>}

            <div className="mt-5 flex flex-wrap justify-end gap-3">
              <button
                type="button"
                disabled={submitting}
                onClick={() => setConfirmOpen(false)}
                className="min-h-[44px] rounded-mi border border-mi-cinza px-4 text-sm text-mi-marrom-escuro hover:bg-mi-cinza/50 disabled:opacity-50"
              >
                Voltar e editar
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={submit}
                className="min-h-[44px] rounded-mi bg-mi-marrom px-5 text-sm text-white shadow-suave hover:bg-mi-marrom-escuro disabled:opacity-50"
              >
                {submitting ? "Salvando…" : "Confirmar e criar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
