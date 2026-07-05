import type { NextAuthOptions } from "next-auth";
import { getServerSession } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "./prisma";
import { lockoutMs } from "./security";
import { isIpThrottled, metaFromHeaders, recordAuth } from "./authlog";

/**
 * Autenticação do painel /admin (M5): credentials (e-mail + senha bcrypt)
 * contra admin_users. Sessão JWT — sem tabela de sessão no banco.
 *
 * Auth F1.2: além da trava por conta (M13.2), agora há rate-limit por IP,
 * auditoria em auth_log e invalidação de sessão por token_version (trocar a
 * senha sobe a versão e derruba todos os JWTs antigos).
 */
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
        const email = credentials?.email?.trim().toLowerCase();
        const password = credentials?.password;
        if (!email || !password) return null;

        // Rate-limit por IP (defesa-em-profundidade além da trava por conta).
        if (await isIpThrottled(meta.ip)) {
          await recordAuth("admin", "throttled", email, meta);
          return null;
        }

        const user = await prisma.adminUser.findUnique({ where: { email } });
        if (!user || !user.active) {
          await recordAuth("admin", "login_fail", email, meta);
          return null;
        }

        // M13.2 — conta travada por brute-force: recusa sem nem checar a senha.
        if (user.lockedUntil && user.lockedUntil > new Date()) {
          await recordAuth("admin", "locked", email, meta);
          return null;
        }

        if (!bcrypt.compareSync(password, user.passwordHash)) {
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
          return null;
        }

        // Sucesso: zera o contador (só escreve se havia o que limpar).
        if (user.failedAttempts > 0 || user.lockedUntil) {
          await prisma.adminUser.update({
            where: { id: user.id },
            data: { failedAttempts: 0, lockedUntil: null },
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
  ],
  session: { strategy: "jwt", maxAge: 12 * 60 * 60 },
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
