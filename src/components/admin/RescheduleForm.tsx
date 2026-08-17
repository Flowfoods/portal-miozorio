"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { adminRescheduleBooking } from "@/app/admin/actions";

/**
 * Remarcação pelo painel (M10.3): disclosure com novo dia/horário. Erro inline
 * (o motor/colisão pode recusar) — não joga a Mi pra tela de erro.
 */
export default function RescheduleForm({
  bookingId,
  defaultDate,
}: {
  bookingId: string;
  defaultDate: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(defaultDate);
  const [time, setTime] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-mi border border-mi-cinza px-3 py-1.5 text-sm"
      >
        ✏️ Remarcar
      </button>
    );
  }

  async function save() {
    if (busy || time.length < 4) return;
    setBusy(true);
    setError(null);
    const fd = new FormData();
    fd.set("id", bookingId);
    fd.set("date", date);
    fd.set("time", time);
    try {
      const r = await adminRescheduleBooking(fd);
      if (!r.ok) {
        setError(r.message);
        return;
      }
      router.push(`/admin?data=${date}`);
      router.refresh();
      setOpen(false);
    } catch {
      setError("Não consegui remarcar. Tente de novo.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-2 w-full rounded-mi border border-mi-cinza bg-mi-bege/40 p-3">
      <div className="flex flex-wrap items-end gap-2">
        <label className="text-xs text-mi-texto">
          Novo dia
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="input-mi mt-1 block"
          />
        </label>
        <label className="text-xs text-mi-texto">
          Horário
          <input
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            className="input-mi mt-1 block"
          />
        </label>
        <button
          type="button"
          disabled={busy || time.length < 4}
          onClick={save}
          className="min-h-[44px] rounded-mi bg-mi-marrom-escuro px-3 text-sm text-white disabled:opacity-50"
        >
          {busy ? "Salvando…" : "Confirmar"}
        </button>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setError(null);
          }}
          className="min-h-[44px] px-2 text-sm text-mi-marrom-escuro"
        >
          cancelar
        </button>
      </div>
      {error && <p className="mt-2 text-sm text-mi-erro-tinta">{error}</p>}
    </div>
  );
}
