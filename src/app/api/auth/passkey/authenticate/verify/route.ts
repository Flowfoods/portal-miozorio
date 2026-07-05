import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { verifyAuthenticationResponse } from "@simplewebauthn/server";
import { prisma } from "@/lib/prisma";
import {
  rpFromHeaders,
  getChallenge,
  clearChallenge,
  fromB64url,
} from "@/lib/webauthn";
import { iniciarSessaoCliente } from "@/lib/cliente-auth";
import { metaFromHeaders, recordAuth } from "@/lib/authlog";

/**
 * Verifica o LOGIN por passkey da CLIENTE e estabelece a sessão (cookie).
 * O login por passkey do ADMIN passa pelo provider "passkey" do NextAuth
 * (não por aqui) — porque a sessão do admin é gerenciada pelo NextAuth.
 */
export async function POST(req: Request) {
  const { response } = await req.json().catch(() => ({}));
  const expectedChallenge = getChallenge();
  if (!expectedChallenge || !response?.id) {
    return NextResponse.json({ error: "cerimônia expirada" }, { status: 400 });
  }

  const cred = await prisma.passkey.findUnique({
    where: { credentialId: response.id },
  });
  if (!cred || cred.area !== "cliente") {
    return NextResponse.json({ error: "passkey desconhecida" }, { status: 400 });
  }

  const { rpID, origin } = rpFromHeaders(headers());
  let verification;
  try {
    verification = await verifyAuthenticationResponse({
      response,
      expectedChallenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      requireUserVerification: false,
      credential: {
        id: cred.credentialId,
        publicKey: fromB64url(cred.publicKey),
        counter: Number(cred.counter),
        transports: cred.transports as never,
      },
    });
  } catch {
    return NextResponse.json({ error: "não foi possível verificar" }, { status: 400 });
  }
  if (!verification.verified) {
    return NextResponse.json({ error: "não verificado" }, { status: 400 });
  }

  await prisma.passkey.update({
    where: { id: cred.id },
    data: {
      counter: BigInt(verification.authenticationInfo.newCounter),
      lastUsedAt: new Date(),
    },
  });
  clearChallenge();
  iniciarSessaoCliente(cred.subjectId);
  await recordAuth("cliente", "passkey_login", null, metaFromHeaders(headers()));
  return NextResponse.json({ ok: true, redirect: "/clube/conta" });
}
