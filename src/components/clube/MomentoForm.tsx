"use client";

import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import Image from "next/image";
import type { ClienteFormState } from "@/app/(site)/clube/conta/actions";

/**
 * Form de momento (F3): texto (até 600), nota opcional em estrelas, até 4
 * fotos, consentimento obrigatório. Reusado para criar e editar (edição
 * volta pra moderação; consent já registrado não se re-pede).
 */
const MAX_CHARS = 600;
const MAX_FOTOS = 4;

export interface BookingOpcao {
  id: string;
  label: string; // "Maquiagem social · 12/07/2026"
}

export interface FotoExistente {
  id: string;
  url: string; // /momentos/foto/<id>
}

function BotaoEnviar({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      disabled={pending}
      className="min-h-[52px] w-full rounded-mi bg-mi-marrom-escuro font-corpo text-base text-mi-branco shadow-suave transition-colors hover:bg-mi-marrom disabled:cursor-not-allowed disabled:opacity-40"
    >
      {pending ? "Enviando…" : label}
    </button>
  );
}

export default function MomentoForm({
  action,
  editar,
  bookings,
  bookingPreselecionado,
}: {
  action: (prev: ClienteFormState, fd: FormData) => Promise<ClienteFormState>;
  /** Presente = modo edição. */
  editar?: {
    id: string;
    texto: string;
    rating: number | null;
    fotos: FotoExistente[];
  };
  bookings?: BookingOpcao[];
  bookingPreselecionado?: string;
}) {
  const [state, formAction] = useFormState(action, null);
  const [texto, setTexto] = useState(editar?.texto ?? "");
  const [rating, setRating] = useState<number>(editar?.rating ?? 0);
  const [qtdNovas, setQtdNovas] = useState(0);

  const maxNovas = MAX_FOTOS - (editar?.fotos.length ?? 0);

  return (
    <form action={formAction} className="space-y-5">
      {editar && <input type="hidden" name="id" value={editar.id} />}

      {/* Atendimento vinculado (só na criação) */}
      {!editar && bookings && bookings.length > 0 && (
        <label className="block">
          <span className="mb-1.5 block font-corpo text-sm text-mi-marrom-escuro">
            Sobre qual atendimento? (opcional)
          </span>
          <select
            name="bookingId"
            defaultValue={bookingPreselecionado ?? ""}
            className="input-mi"
          >
            <option value="">Um momento em geral</option>
            {bookings.map((b) => (
              <option key={b.id} value={b.id}>
                {b.label}
              </option>
            ))}
          </select>
        </label>
      )}

      {/* Texto */}
      <label className="block">
        <span className="mb-1.5 block font-corpo text-sm text-mi-marrom-escuro">
          Conte como foi 💛
        </span>
        <textarea
          name="texto"
          value={texto}
          onChange={(e) => setTexto(e.target.value.slice(0, MAX_CHARS))}
          required
          rows={5}
          className="input-mi"
          placeholder="O que você sentiu, como foi o cuidado, o resultado…"
        />
        <span className="mt-1 block text-right font-corpo text-xs text-mi-texto/80">
          {texto.length}/{MAX_CHARS}
        </span>
      </label>

      {/* Nota opcional */}
      <div>
        <span className="mb-1.5 block font-corpo text-sm text-mi-marrom-escuro">
          Sua nota (opcional)
        </span>
        <input type="hidden" name="rating" value={rating || ""} />
        <div className="flex items-center gap-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              aria-label={`${n} de 5 estrelas`}
              aria-pressed={rating >= n}
              onClick={() => setRating(rating === n ? 0 : n)}
              className="inline-flex h-11 w-11 items-center justify-center"
            >
              <svg
                width="26"
                height="26"
                viewBox="0 0 24 24"
                aria-hidden="true"
                className={rating >= n ? "text-mi-marrom" : "text-mi-cinza"}
                fill="currentColor"
              >
                <path d="M12 2.5l2.95 5.98 6.6.96-4.78 4.65 1.13 6.58L12 17.57l-5.9 3.1 1.13-6.58L2.45 9.44l6.6-.96L12 2.5z" />
              </svg>
            </button>
          ))}
        </div>
      </div>

      {/* Fotos existentes (edição) */}
      {editar && editar.fotos.length > 0 && (
        <div>
          <span className="mb-1.5 block font-corpo text-sm text-mi-marrom-escuro">
            Suas fotos (marque para remover)
          </span>
          <div className="flex flex-wrap gap-3">
            {editar.fotos.map((f) => (
              <label
                key={f.id}
                className="relative block cursor-pointer overflow-hidden rounded-mi border border-mi-cinza"
              >
                <Image
                  src={f.url}
                  alt="Sua foto"
                  width={88}
                  height={110}
                  unoptimized
                  className="h-[110px] w-[88px] object-cover"
                />
                <span className="absolute bottom-1 right-1 rounded bg-mi-branco/90 px-1.5 py-0.5 font-corpo text-[10px]">
                  <input type="checkbox" name="removerFoto" value={f.id} />{" "}
                  remover
                </span>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Fotos novas */}
      {maxNovas > 0 && (
        <label className="block">
          <span className="mb-1.5 block font-corpo text-sm text-mi-marrom-escuro">
            {editar ? "Adicionar fotos" : "Suas fotos (opcional)"} — até{" "}
            {maxNovas}, JPG/PNG/WebP, 8MB cada
          </span>
          <input
            type="file"
            name="fotos"
            accept="image/jpeg,image/png,image/webp"
            multiple
            onChange={(e) => setQtdNovas(e.target.files?.length ?? 0)}
            className="block w-full font-corpo text-sm text-mi-texto file:mr-3 file:rounded-mi file:border-0 file:bg-mi-cinza file:px-4 file:py-2.5 file:font-corpo file:text-sm file:text-mi-marrom-escuro"
          />
          {qtdNovas > maxNovas && (
            <span className="mt-1 block font-corpo text-xs text-red-700">
              Só as {maxNovas} primeiras fotos serão enviadas.
            </span>
          )}
        </label>
      )}

      {/* Consentimento (obrigatório na criação; edição mantém o registrado) */}
      {!editar && (
        <label className="flex items-start gap-3 font-corpo text-sm text-mi-texto">
          <input
            type="checkbox"
            name="consent"
            required
            className="mt-1 h-5 w-5 accent-mi-marrom"
          />
          <span>
            Autorizo a Mi Ozorio a exibir meu depoimento e fotos no site e nas
            redes sociais.
          </span>
        </label>
      )}

      {state?.error && (
        <p className="font-corpo text-sm text-red-700">{state.error}</p>
      )}

      <BotaoEnviar label={editar ? "Reenviar para a Mi" : "Enviar para a Mi"} />
      <p className="text-center font-corpo text-xs text-mi-texto/80">
        A Mi lê tudo com carinho antes de publicar 💛
      </p>
    </form>
  );
}
