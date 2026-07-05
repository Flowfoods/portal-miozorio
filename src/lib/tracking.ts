import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";

/**
 * CRM 2.0 F1 — camada de eventos de comportamento (first-party, sem libs de
 * terceiros). Uma sessão anônima é um cookie httpOnly `mi_sid` (UUID, sem PII);
 * ao logar no Clube, os eventos daquela sessão são vinculados à cliente (merge).
 *
 * Princípios de segurança (sec-audit / R18):
 * - `clientId` NUNCA vem do request — quem resolve é o servidor pela sessão.
 * - `metadata` passa por sanitização: sem PII e sem dado de saúde.
 * - Só um conjunto branco de tipos pode ser emitido pelo beacon do cliente
 *   (CLIENT_EMITTABLE); "concluí um agendamento" etc. são server-only.
 * - Este módulo NÃO importa cliente-auth (evita ciclo): o resolvedor de cliente
 *   fica em quem chama (ex.: a rota /api/track).
 */

export const ANON_COOKIE = "mi_sid";
const TTL_MS = 365 * 24 * 60 * 60 * 1000; // 1 ano

export const EV = {
  SESSAO_INICIADA: "SESSAO_INICIADA",
  LOGIN_CLUBE: "LOGIN_CLUBE",
  VISUALIZOU_AGENDAMENTO: "VISUALIZOU_AGENDAMENTO",
  INICIOU_AGENDAMENTO: "INICIOU_AGENDAMENTO",
  ABANDONOU_AGENDAMENTO: "ABANDONOU_AGENDAMENTO",
  AGENDAMENTO_CONCLUIDO: "AGENDAMENTO_CONCLUIDO",
  LINK_INDICACAO_COMPARTILHADO: "LINK_INDICACAO_COMPARTILHADO",
  LINK_INDICACAO_ACESSADO: "LINK_INDICACAO_ACESSADO",
  VISUALIZOU_RECOMPENSAS: "VISUALIZOU_RECOMPENSAS",
  RESGATE_REALIZADO: "RESGATE_REALIZADO",
} as const;

export type EventType = (typeof EV)[keyof typeof EV];

/** Tipos que o beacon do cliente pode emitir (o resto é só servidor). */
export const CLIENT_EMITTABLE: ReadonlySet<string> = new Set([
  EV.SESSAO_INICIADA,
  EV.VISUALIZOU_AGENDAMENTO,
  EV.INICIOU_AGENDAMENTO,
  EV.ABANDONOU_AGENDAMENTO,
  EV.LINK_INDICACAO_COMPARTILHADO,
  EV.LINK_INDICACAO_ACESSADO,
  EV.VISUALIZOU_RECOMPENSAS,
]);

function cookieOpts() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: TTL_MS / 1000,
  };
}

/** Lê o mi_sid (ou null). Seguro em qualquer contexto de servidor. */
export function getSid(): string | null {
  return cookies().get(ANON_COOKIE)?.value ?? null;
}

/** Lê ou cria o mi_sid, setando o cookie. Só em Route Handler / Server Action. */
export function ensureSid(): string {
  const existing = cookies().get(ANON_COOKIE)?.value;
  if (existing) return existing;
  const sid = randomUUID();
  cookies().set(ANON_COOKIE, sid, cookieOpts());
  return sid;
}

// Sanitização de metadata: sem PII, sem dado de saúde, valores primitivos e curtos.
const META_MAX_KEYS = 12;
const META_STR_MAX = 200;
const META_BLOCKED = new Set([
  "alergia", "allergy", "alergias", "anamnese", "saude", "cpf", "rg",
  "email", "phone", "telefone", "whatsapp", "senha", "password",
  "nome", "name", "endereco", "address",
]);

/** Mantém só chaves não sensíveis com valores primitivos curtos. */
export function sanitizeMeta(meta: unknown): Record<string, unknown> | undefined {
  if (!meta || typeof meta !== "object") return undefined;
  const out: Record<string, unknown> = {};
  let n = 0;
  for (const [rawKey, v] of Object.entries(meta as Record<string, unknown>)) {
    if (n >= META_MAX_KEYS) break;
    const key = String(rawKey).slice(0, 40).toLowerCase();
    if (META_BLOCKED.has(key)) continue;
    if (typeof v === "string") out[key] = v.slice(0, META_STR_MAX);
    else if (typeof v === "number" && Number.isFinite(v)) out[key] = v;
    else if (typeof v === "boolean") out[key] = v;
    else continue;
    n++;
  }
  return Object.keys(out).length ? out : undefined;
}

export interface TrackInput {
  tipo: EventType | string;
  /** Resolvido pelo chamador a partir da sessão — nunca do request. */
  clientId?: string | null;
  sessionId?: string | null;
  origem?: string;
  metadata?: unknown;
}

/** Grava um evento (best-effort — nunca lança para o chamador). */
export async function track(input: TrackInput): Promise<void> {
  try {
    const sessionId = input.sessionId ?? getSid();
    if (!sessionId) return; // sem sessão anônima ainda: não rastreia
    const meta = sanitizeMeta(input.metadata);
    await prisma.clientEvent.create({
      data: {
        clientId: input.clientId ?? null,
        sessionId,
        tipo: String(input.tipo).slice(0, 60),
        origem: input.origem === "whatsapp" ? "whatsapp" : "web",
        ...(meta ? { metadata: meta as Prisma.InputJsonValue } : {}),
      },
    });
  } catch (e) {
    console.error("track: falha ao gravar evento", e);
  }
}

/** Vincula à cliente os eventos anônimos da sessão (chamado no login do Clube). */
export async function mergeAnonToClient(
  customerId: string,
  sid: string | null,
): Promise<void> {
  if (!sid) return;
  try {
    await prisma.clientEvent.updateMany({
      where: { sessionId: sid, clientId: null },
      data: { clientId: customerId },
    });
  } catch (e) {
    console.error("track: falha no merge anônimo→cliente", e);
  }
}
