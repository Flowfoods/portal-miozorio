import { NextResponse } from "next/server";
import { headers } from "next/headers";
import {
  generateRegistrationOptions,
  type AuthenticatorTransportFuture,
} from "@simplewebauthn/server";
import { prisma } from "@/lib/prisma";
import { sujeitoAtual } from "@/lib/passkeys";
import { rpFromHeaders, setChallenge, encodeUserHandle } from "@/lib/webauthn";

/** Opções da cerimônia de CADASTRO de passkey (exige sessão). */
export async function POST(req: Request) {
  const { area } = await req.json().catch(() => ({}));
  if (area !== "admin" && area !== "cliente") {
    return NextResponse.json({ error: "área inválida" }, { status: 400 });
  }
  const suj = await sujeitoAtual(area);
  if (!suj) return NextResponse.json({ error: "não autorizado" }, { status: 401 });

  const { rpID, rpName } = rpFromHeaders(headers());
  const existentes = await prisma.passkey.findMany({
    where: { area, subjectId: suj.subjectId },
    select: { credentialId: true, transports: true },
  });

  const options = await generateRegistrationOptions({
    rpName,
    rpID,
    userID: encodeUserHandle(area, suj.subjectId),
    userName: suj.userName,
    attestationType: "none",
    excludeCredentials: existentes.map((e) => ({
      id: e.credentialId,
      transports: e.transports as AuthenticatorTransportFuture[],
    })),
    authenticatorSelection: {
      residentKey: "preferred",
      userVerification: "preferred",
    },
  });

  setChallenge(options.challenge);
  return NextResponse.json(options);
}
