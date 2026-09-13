import type { NextAuthOptions } from "next-auth";
import { getServerSession } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { verifyAuthenticationResponse } from "@simplewebauthn/server";
import { prisma } from "./prisma";
import { BCRYPT_ROUNDS, hashFraco, lockoutMs } from "./security";
import {
  isIpThrottled,
  metaFromHeaders,
  recordAuth,
  throttlePorIdentificador,
} from "./authlog";
import { challengeFromCookieHeader, fromB64url } from "./webauthn";
import { TTL_SESSAO_ADMIN_S } from "./auth-cookies";
import { normalizarEmail, normalizarSenha } from "./auth-identidade";
import { ERRO_THROTTLED, codigoLocked } from "./auth-mensagens";

/**
 * Autenticação do painel /admin (M5): credentials (e-mail + senha bcrypt)
 * contra admin_users. Sessão JWT — sem tabela de sessão no banco.
 *
 * Auth F1.2: além da trava por conta (M13.2), agora há rate-limit por IP,
 * auditoria em auth_log e invalidação de sessão por token_version (trocar a
 * senha sobe a versão e derruba todos os JWTs antigos).
 */

/** Cookie `Secure` sempre que o portal roda em https (prod atrás do Traefik). */
const useSecureCookies = (process.env.NEXTAUTH_URL ?? "").startsWith("https://");


export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Painel Mi Ozorio",
      credentials: {
        email: { label: "E-mail", type: "email" },
        password: { label: "Senha", type: "password" },
      },
      async authorize(credentials, req) {
        const meta = metaFromHeaders(req?.headers);
        // B1 — mesma normalização do cadastro (`auth-identidade`): e-mail em
        // minúsculas e senha com trim só nas pontas (teclado de celular
        // acrescenta espaço ao aceitar a sugestão do corretor).
        const email = normalizarEmail(credentials?.email);
        const passwordBruta = credentials?.password ?? "";
        const password = normalizarSenha(passwordBruta);
        if (!email || !password) return null;

        // Rate-limit por IP (defesa-em-profundidade além da trava por conta).
        if (await isIpThrottled(meta.ip)) {
          await recordAuth("admin", "throttled", email, meta);
          throw new Error(ERRO_THROTTLED);
        }
        // B4 — e por identificador: 10 falhas em 15 min pausam este e-mail,
        // venham de onde vierem. Com o tempo de espera na tela.
        const porEmail = await throttlePorIdentificador("admin", email);
        if (porEmail.bloqueado) {
          await recordAuth("admin", "throttled", email, meta);
          throw new Error(
            codigoLocked(new Date(Date.now() + porEmail.minutos * 60_000)),
          );
        }

        const user = await prisma.adminUser.findUnique({ where: { email } });
        if (!user || !user.active) {
          await recordAuth("admin", "login_fail", email, meta);
          return null;
        }

        // M13.2 — conta travada por brute-force: recusa sem nem checar a senha.
        if (user.lockedUntil && user.lockedUntil > new Date()) {
          await recordAuth("admin", "locked", email, meta);
          throw new Error(codigoLocked(user.lockedUntil));
        }

        let senhaOk = bcrypt.compareSync(password, user.passwordHash);
        // Compatibilidade: senha gravada ANTES do trim (com espaço nas pontas)
        // continua entrando, e o hash é regravado já normalizado. Nenhuma senha
        // existente é invalidada nem exige reset.
        let reidratarHash = false;
        if (!senhaOk && passwordBruta !== password) {
          senhaOk = bcrypt.compareSync(passwordBruta, user.passwordHash);
          reidratarHash = senhaOk;
        }
        // Hash com custo menor que o padrão atual sobe de graça no login certo.
        if (senhaOk && hashFraco(user.passwordHash)) reidratarHash = true;

        if (!senhaOk) {
          // Falhou: incrementa e, passando do limite, trava com backoff.
          const failedAttempts = user.failedAttempts + 1;
          const ms = lockoutMs(failedAttempts);
          await prisma.adminUser.update({
            where: { id: user.id },
            data: {
              failedAttempts,
              lockedUntil: ms > 0 ? new Date(Date.now() + ms) : user.lockedUntil,
            },
          });
          await recordAuth("admin", ms > 0 ? "locked" : "login_fail", email, meta);
          if (ms > 0) throw new Error(codigoLocked(new Date(Date.now() + ms)));
          return null;
        }

        // Sucesso: zera o contador (só escreve se havia o que limpar).
        if (user.failedAttempts > 0 || user.lockedUntil || reidratarHash) {
          await prisma.adminUser.update({
            where: { id: user.id },
            data: {
              failedAttempts: 0,
              lockedUntil: null,
              ...(reidratarHash
                ? { passwordHash: bcrypt.hashSync(password, BCRYPT_ROUNDS) }
                : {}),
            },
          });
        }

        await recordAuth("admin", "login_ok", email, meta);
        // tokenVersion viaja no JWT (invalidação ao trocar senha).
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          tokenVersion: user.tokenVersion,
        } as unknown as { id: string; email: string; name: string };
      },
    }),
    // Login por PASSKEY do admin (Auth F3). Verifica a asserção WebAuthn e
    // devolve o admin — a senha continua como fallback (provider acima).
    CredentialsProvider({
      id: "passkey",
      name: "Passkey",
      credentials: { assertion: { label: "assertion", type: "text" } },
      async authorize(credentials, req) {
        const meta = metaFromHeaders(req?.headers);
        if (!credentials?.assertion) return null;
        let response: { id?: string };
        try {
          response = JSON.parse(credentials.assertion);
        } catch {
          return null;
        }
        if (!response?.id) return null;

        const expectedChallenge = challengeFromCookieHeader(
          (req?.headers as Record<string, string> | undefined)?.cookie ?? null,
        );
        if (!expectedChallenge) return null;

        const cred = await prisma.passkey.findUnique({
          where: { credentialId: response.id },
        });
        if (!cred || cred.area !== "admin") return null;

        const h = (req?.headers ?? {}) as Record<string, string>;
        const host = h["x-forwarded-host"] ?? h["host"] ?? "localhost:3000";
        const proto =
          h["x-forwarded-proto"] ?? (host.startsWith("localhost") ? "http" : "https");
        const rpID = host.split(":")[0]!;
        const origin = `${proto}://${host}`;

        let verification;
        try {
          verification = await verifyAuthenticationResponse({
            response: response as never,
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
          return null;
        }
        if (!verification.verified) return null;

        const u = await prisma.adminUser.findUnique({
          where: { id: cred.subjectId },
        });
        if (!u || !u.active) return null;

        await prisma.passkey.update({
          where: { id: cred.id },
          data: {
            counter: BigInt(verification.authenticationInfo.newCounter),
            lastUsedAt: new Date(),
          },
        });
        await recordAuth("admin", "passkey_login", u.email, meta);
        return {
          id: u.id,
          email: u.email,
          name: u.name,
          tokenVersion: u.tokenVersion,
        } as unknown as { id: string; email: string; name: string };
      },
    }),
  ],
  // B1 — 7 dias (antes 12h). A Mi opera pelo celular o dia inteiro e caía do
  // painel no meio do atendimento; 7 dias é o teto para acesso privilegiado, e
  // o token_version continua derrubando tudo na hora se a senha mudar.
  session: { strategy: "jwt", maxAge: TTL_SESSAO_ADMIN_S },
  cookies: {
    // `SameSite=Lax` explícito (nunca `Strict`): a Mi abre o painel por link do
    // WhatsApp e com `Strict` o cookie não viaja nessa primeira navegação.
    sessionToken: {
      name: useSecureCookies
        ? "__Secure-next-auth.session-token"
        : "next-auth.session-token",
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: useSecureCookies,
      },
    },
  },
  pages: { signIn: "/admin/login" },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.uid = (user as { id: string }).id;
        token.tv = (user as { tokenVersion?: number }).tokenVersion ?? 0;
      }
      return token;
    },
    async session({ session, token }) {
      // Invalidação: se a senha foi trocada (token_version subiu) ou a conta
      // foi desativada, a sessão morre — devolve sem `user` e requireAdmin recusa.
      const uid = token?.uid as string | undefined;
      if (uid) {
        const u = await prisma.adminUser.findUnique({
          where: { id: uid },
          select: { tokenVersion: true, active: true, email: true, name: true },
        });
        if (!u || !u.active || u.tokenVersion !== ((token.tv as number) ?? 0)) {
          return { ...session, user: undefined } as typeof session;
        }
        session.user = { email: u.email, name: u.name };
      }
      return session;
    },
  },
};

/** Sessão do admin no servidor; null se não autenticada. */
export function getAdminSession() {
  return getServerSession(authOptions);
}

/** Guarda de server actions/rotas admin: lança se não autenticada. */
export async function requireAdmin() {
  const session = await getAdminSession();
  if (!session?.user?.email) {
    throw new Error("Não autorizado");
  }
  return session;
}
