import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

/**
 * Núcleo WebAuthn / Passkeys (Auth F3) — compartilhado pelos dois portais.
 * O `rpID`/origin vêm do host do request (funciona em prod e em dev/localhost).
 * O challenge da cerimônia vive num cookie httpOnly curto, assinado por HMAC
 * (sem tabela). Passkey é SEMPRE adicional: a senha continua como fallback.
 */

export type Area = "admin" | "cliente";
const CHAL_COOKIE = "mi_wa_chal";
const CHAL_TTL_MS = 5 * 60_000;
export const RP_NAME = "Mi Ozorio";

function secret(): string {
  const s = process.env.NEXTAUTH_SECRET;
  if (!s) throw new Error("NEXTAUTH_SECRET ausente");
  return s;
}
function sign(data: string): string {
  return createHmac("sha256", secret()).update(data).digest("base64url");
}
function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

/** rpID (hostname), rpName e origin a partir dos headers do request. */
export function rpFromHeaders(h: Headers): {
  rpID: string;
  rpName: string;
  origin: string;
} {
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto =
    h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const rpID = host.split(":")[0]!;
  return { rpID, rpName: RP_NAME, origin: `${proto}://${host}` };
}

// ── Challenge (cookie assinado, curto) ───────────────────────────────────────
export function setChallenge(challenge: string): void {
  const body = `${challenge}.${Date.now() + CHAL_TTL_MS}`;
  cookies().set(CHAL_COOKIE, `${body}.${sign(body)}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: CHAL_TTL_MS / 1000,
  });
}
export function getChallenge(): string | null {
  const raw = cookies().get(CHAL_COOKIE)?.value;
  return raw ? parseChallenge(raw) : null;
}
/** Lê o challenge de um header Cookie cru (usado no provider do NextAuth). */
export function challengeFromCookieHeader(cookieHeader: string | null): string | null {
  if (!cookieHeader) return null;
  const m = cookieHeader.match(new RegExp(`${CHAL_COOKIE}=([^;]+)`));
  return m ? parseChallenge(decodeURIComponent(m[1]!)) : null;
}
function parseChallenge(raw: string): string | null {
  const i = raw.lastIndexOf(".");
  if (i < 0) return null;
  const body = raw.slice(0, i);
  const sig = raw.slice(i + 1);
  if (!safeEqual(sig, sign(body))) return null;
  const j = body.lastIndexOf(".");
  const challenge = body.slice(0, j);
  const exp = Number(body.slice(j + 1));
  if (!challenge || !exp || exp < Date.now()) return null;
  return challenge;
}
export function clearChallenge(): void {
  cookies().delete(CHAL_COOKIE);
}

// ── Helpers de codificação ───────────────────────────────────────────────────
export function b64url(buf: Uint8Array): string {
  return Buffer.from(buf).toString("base64url");
}
// Uint8Array.from aloca um ArrayBuffer "puro" (não ArrayBufferLike) — é o que o
// @simplewebauthn espera na tipagem nova do TS.
export function fromB64url(s: string): Uint8Array<ArrayBuffer> {
  return Uint8Array.from(Buffer.from(s, "base64url"));
}

/** userHandle = "area:subjectId" em bytes — identifica a conta no login sem senha. */
export function encodeUserHandle(
  area: Area,
  subjectId: string,
): Uint8Array<ArrayBuffer> {
  return Uint8Array.from(new TextEncoder().encode(`${area}:${subjectId}`));
}
export function decodeUserHandle(
  handle: string,
): { area: Area; subjectId: string } | null {
  try {
    const s = new TextDecoder().decode(fromB64url(handle));
    const [area, subjectId] = s.split(":");
    if ((area === "admin" || area === "cliente") && subjectId) {
      return { area, subjectId };
    }
  } catch {
    /* ignore */
  }
  return null;
}
