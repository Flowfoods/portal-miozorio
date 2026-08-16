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

async function evoFetch(path: string, method = "GET"): Promise<unknown> {
  const { base, key } = cfg();
  const res = await fetch(`${base}${path}`, {
    method,
    headers: { apikey: key },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Evolution ${res.status}`);
  return res.json();
}

/**
 * Código de pareamento por NÚMERO (8 dígitos), alternativa ao QR.
 *
 * É o caminho que serve à Mi de verdade: ela opera pelo celular, e ler um QR
 * exige um SEGUNDO aparelho — não dá para fotografar a tela do próprio
 * telefone que está com o WhatsApp aberto. Com o código ela digita em
 * Aparelhos conectados → Conectar com número de telefone.
 *
 * A Evolution só devolve `pairingCode` quando o número vai na query; sem ele,
 * a resposta traz apenas o QR — por isso o campo vinha sempre nulo.
 */
export async function evolutionPairingCode(
  numero: string,
): Promise<{ ok: true; code: string } | { ok: false; message: string }> {
  if (!evolutionConfigured()) {
    return { ok: false, message: "WhatsApp não configurado no servidor." };
  }
  const digits = (numero ?? "").replace(/\D/g, "");
  // E.164 sem o "+": 55 + DDD + número.
  const full = digits.length <= 11 ? `55${digits}` : digits;
  if (full.length < 12 || full.length > 13) {
    return { ok: false, message: "Confere o número? Use DDD + WhatsApp." };
  }
  try {
    const { instance } = cfg();
    const j = (await evoFetch(
      `/instance/connect/${instance}?number=${full}`,
    )) as { pairingCode?: string | null; code?: string | null };
    const code = j?.pairingCode ?? null;
    if (!code) {
      return {
        ok: false,
        message:
          "O WhatsApp não devolveu o código agora. Tente 'Começar de novo' e peça outra vez.",
      };
    }
    return { ok: true, code };
  } catch {
    return { ok: false, message: "O WhatsApp não respondeu agora." };
  }
}

/**
 * Encerra a sessão na Evolution para começar o pareamento do zero.
 *
 * Instância presa em "connecting" devolve QR que já nasce inválido: a pessoa
 * aponta a câmera e nada acontece, indefinidamente. Sem um logout não havia
 * como sair desse estado pelo painel — só mexendo no container.
 */
export async function evolutionLogout(): Promise<boolean> {
  if (!evolutionConfigured()) return false;

  // Só desconecta o que está conectado. Pedir logout de instância que não está
  // em "open" faz o Baileys lançar 428 (Precondition Required) — e essa exceção
  // NÃO é tratada dentro da Evolution: derruba o processo inteiro e o container
  // sai com código 1. Foi observado em produção em 15/08, com o rastro parando
  // em logoutInstance. O botão "Começar de novo" chamava isto sem guarda
  // nenhuma, justamente no estado em que o logout é ilegal.
  const state = await evolutionState();
  if (state !== "open") return true; // já desconectada: nada a fazer, sem erro

  const { instance } = cfg();
  for (const method of ["DELETE", "POST"]) {
    try {
      await evoFetch(`/instance/logout/${instance}`, method);
      return true;
    } catch {
      // Versões diferentes da Evolution expõem o logout em verbos diferentes;
      // tenta o outro antes de desistir.
    }
  }
  return false;
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
