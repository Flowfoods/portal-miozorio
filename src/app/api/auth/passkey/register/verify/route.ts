import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { verifyRegistrationResponse } from "@simplewebauthn/server";
import { prisma } from "@/lib/prisma";
import { sujeitoAtual } from "@/lib/passkeys";
import {
  rpFromHeaders,
  getChallenge,
  clearChallenge,
  b64url,
} from "@/lib/webauthn";
import { metaFromHeaders, recordAuth } from "@/lib/authlog";

/** Verifica a cerimônia de CADASTRO e salva a passkey (exige sessão). */
export async function POST(req: Request) {
  const { area, deviceName, response } = await req.json().catch(() => ({}));
  if (area !== "admin" && area !== "cliente") {
    return NextResponse.json({ error: "área inválida" }, { status: 400 });
  }
  const suj = await sujeitoAtual(area);
  if (!suj) return NextResponse.json({ error: "não autorizado" }, { status: 401 });

  const expectedChallenge = getChallenge();
  if (!expectedChallenge || !response) {
    return NextResponse.json({ error: "cerimônia expirada" }, { status: 400 });
  }
  const { rpID, origin } = rpFromHeaders(headers());

  let verification;
  try {
    verification = await verifyRegistrationResponse({
      response,
      expectedChallenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      requireUserVerification: false,
    });
  } catch {
    return NextResponse.json({ error: "não foi possível verificar" }, { status: 400 });
  }
  if (!verification.verified || !verification.registrationInfo) {
    return NextResponse.json({ error: "não verificado" }, { status: 400 });
  }

  const { credential } = verification.registrationInfo;
  await prisma.passkey.create({
    data: {
      area,
      subjectId: suj.subjectId,
      credentialId: credential.id,
      publicKey: b64url(credential.publicKey),
      counter: BigInt(credential.counter),
      transports: credential.transports ?? [],
      deviceName: String(deviceName || "Meu dispositivo").slice(0, 60),
    },
  });

  clearChallenge();
  await recordAuth(
    area,
    "passkey_added",
    area === "admin" ? suj.userName : null,
    metaFromHeaders(headers()),
  );
  return NextResponse.json({ ok: true });
}
