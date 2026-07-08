import { evolutionConfigured } from "./notify";

/**
 * Conexão da instância WhatsApp na Evolution (admin → Configurações → WhatsApp).
 * Só server-side: a `apikey` é segredo (R9) e NUNCA vai ao browser. Expõe o
 * estado da instância e o QR code para a Mi parear o celular (como WhatsApp Web).
 *
 * Endpoints Evolution:
 *  - GET /instance/connectionState/{instance} → { instance: { state } }
 *  - GET /instance/connect/{instance}         → { base64, code, pairingCode }
 */

function cfg() {
  return {
    base: (process.env.EVOLUTION_API_URL ?? "").replace(/\/$/, ""),
    key: process.env.EVOLUTION_API_KEY ?? "",
    instance: process.env.EVOLUTION_INSTANCE ?? "",
  };
}

/** Estado normalizado: "open" (conectado) | "connecting" | "close" | null. */
export type EvolutionState = "open" | "connecting" | "close" | null;

export interface EvolutionStatus {
  configured: boolean;
  state: EvolutionState;
  /** data:image/png;base64,… do QR (só quando desconectado e há QR novo). */
  qrBase64: string | null;
  /** Código de pareamento por número (alternativa ao QR), quando a Evolution dá. */
  pairingCode: string | null;
  instance: string | null;
}

const OFFLINE: EvolutionStatus = {
  configured: false,
  state: null,
  qrBase64: null,
  pairingCode: null,
  instance: null,
};

async function evoFetch(path: string): Promise<unknown> {
  const { base, key } = cfg();
  const res = await fetch(`${base}${path}`, {
    headers: { apikey: key },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Evolution ${res.status}`);
  return res.json();
}

/** Só o estado da instância (barato — usado no card de status). */
export async function evolutionState(): Promise<EvolutionState> {
  if (!evolutionConfigured()) return null;
  try {
    const { instance } = cfg();
    const j = (await evoFetch(`/instance/connectionState/${instance}`)) as {
      instance?: { state?: string };
      state?: string;
    };
    return (j?.instance?.state ?? j?.state ?? null) as EvolutionState;
  } catch {
    return null;
  }
}

/**
 * Estado + QR para parear. Se já estiver "open", não pede QR. Best-effort: se a
 * Evolution estiver fora do ar, devolve state=null (a UI mostra o aviso).
 */
export async function evolutionStatus(): Promise<EvolutionStatus> {
  if (!evolutionConfigured()) return OFFLINE;
  const { instance } = cfg();

  const state = await evolutionState();
  if (state === "open") {
    return {
      configured: true,
      state: "open",
      qrBase64: null,
      pairingCode: null,
      instance,
    };
  }

  try {
    const j = (await evoFetch(`/instance/connect/${instance}`)) as {
      base64?: string;
      code?: string;
      pairingCode?: string | null;
      qrcode?: { base64?: string };
    };
    const qr = j?.base64 ?? j?.qrcode?.base64 ?? null;
    return {
      configured: true,
      state: state ?? "connecting",
      // A Evolution às vezes manda o base64 sem o prefixo data-uri.
      qrBase64: qr
        ? qr.startsWith("data:")
          ? qr
          : `data:image/png;base64,${qr}`
        : null,
      pairingCode: j?.pairingCode ?? null,
      instance,
    };
  } catch {
    return {
      configured: true,
      state,
      qrBase64: null,
      pairingCode: null,
      instance,
    };
  }
}
