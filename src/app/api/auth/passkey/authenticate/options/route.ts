import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { generateAuthenticationOptions } from "@simplewebauthn/server";
import { rpFromHeaders, setChallenge } from "@/lib/webauthn";

/**
 * Opções da cerimônia de LOGIN por passkey (público — sem sessão ainda).
 * Discoverable/usernameless: `allowCredentials` vazio; o userHandle da asserção
 * identifica a conta. Serve os dois portais (admin e cliente).
 */
export async function POST() {
  const { rpID } = rpFromHeaders(headers());
  const options = await generateAuthenticationOptions({
    rpID,
    userVerification: "preferred",
    allowCredentials: [],
  });
  setChallenge(options.challenge);
  return NextResponse.json(options);
}
