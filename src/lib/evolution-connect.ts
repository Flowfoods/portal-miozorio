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

async function evoFetch(
  path: string,
  method = "GET",
  body?: unknown,
): Promise<unknown> {
  const { base, key } = cfg();
  const res = await fetch(`${base}${path}`, {
    method,
    headers: {
      apikey: key,
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
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
/**
 * Apaga e recria a instância na Evolution — o "desligar da tomada" de verdade.
 *
 * Diagnóstico de 16/08: com log verboso (156 linhas), um pedido de pareamento
 * não deixa NENHUM rastro — zero "qr", zero "pairing", zero erro. A instância
 * existe como registro no banco da Evolution, mas o processo não a inicializa:
 * registro corrompido. Logout não alcança isso (a sessão nem chega a existir);
 * só apagar o registro e criar de novo destrava.
 *
 * Custo zero por desenho: a instância nunca conectou, e o histórico dela são
 * 2 mensagens de junho. Se um dia isto rodar sobre uma instância SAUDÁVEL, o
 * efeito é o mesmo do "desconectar e parear de novo" — nada além da sessão é
 * perdido (mensagens vivem no banco da Evolution, não na instância).
 */
export async function evolutionRecreate(): Promise<
  { ok: true } | { ok: false; message: string }
> {
  if (!evolutionConfigured()) {
    return { ok: false, message: "WhatsApp não configurado no servidor." };
  }
  const { instance } = cfg();

  // Desconecta antes se (e só se) estiver conectada — a guarda contra o 428
  // que derruba a Evolution vive dentro de evolutionLogout.
  await evolutionLogout();

  // Apaga o registro. 404 = já não existia; qualquer outro erro também não
  // impede a recriação — o create diz se o nome ainda está ocupado.
  try {
    await evoFetch(`/instance/delete/${instance}`, "DELETE");
  } catch {
    // segue para o create
  }

  try {
    await evoFetch("/instance/create", "POST", {
      instanceName: instance,
      integration: "WHATSAPP-BAILEYS",
      qrcode: true,
    });
    limparCacheQr(); // a instância nova não pode herdar QR da antiga
    return { ok: true };
  } catch (e) {
    const msg = String((e as { message?: string })?.message ?? e);
    // 403/409 = o delete não pegou e o nome segue ocupado.
    return {
      ok: false,
      message: msg.includes("403") || msg.includes("409")
        ? "A instância antiga não quis sair. Espere um minuto e tente de novo."
        : "O WhatsApp não respondeu agora. Tente de novo em instantes.",
    };
  }
}

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
 * O MESMO QR precisa sobreviver tempo suficiente para uma câmera focar.
 *
 * Cada chamada a /instance/connect gera um QR NOVO na Evolution — e a tela de
 * pareamento consulta o status a cada 5s. Sem este cache, o QR trocava a cada
 * consulta: a câmera não validava nunca (quando focava, o código já era
 * outro), e o teto de 30 QRs por ciclo (QRCODE_LIMIT) queimava em ~2,5 min —
 * daí em diante a Evolution parava de gerar e a tela ficava em "Gerando o
 * QR…" para sempre. Visto em produção em 16/08: qrcodeCount subindo a cada 5s.
 *
 * 18s de vida: o WhatsApp rotaciona o desafio em ~20s, então o cache nunca
 * serve QR morto. Módulo-escopo funciona porque o standalone roda em um único
 * processo.
 */
let qrCache: { qr: string | null; pairing: string | null; em: number } | null =
  null;
const QR_CACHE_MS = 18_000;

/** Zera o cache — chamado ao recriar a instância, para o QR nascer novo. */
export function limparCacheQr(): void {
  qrCache = null;
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
    qrCache = null;
    return {
      configured: true,
      state: "open",
      qrBase64: null,
      pairingCode: null,
      instance,
    };
  }

  if (qrCache?.qr && Date.now() - qrCache.em < QR_CACHE_MS) {
    return {
      configured: true,
      state: state ?? "connecting",
      qrBase64: qrCache.qr,
      pairingCode: qrCache.pairing,
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
    const bruto = j?.base64 ?? j?.qrcode?.base64 ?? null;
    // A Evolution às vezes manda o base64 sem o prefixo data-uri.
    const qr = bruto
      ? bruto.startsWith("data:")
        ? bruto
        : `data:image/png;base64,${bruto}`
      : null;
    const pairing = j?.pairingCode ?? null;
    if (qr) qrCache = { qr, pairing, em: Date.now() };
    return {
      configured: true,
      state: state ?? "connecting",
      qrBase64: qr,
      pairingCode: pairing,
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
