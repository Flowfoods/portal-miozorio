import type { NextAuthOptions } from "next-auth";
import { getServerSession } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "./prisma";
import { lockoutMs } from "./security";

/**
 * Autenticação do painel /admin (M5): credentials (e-mail + senha bcrypt)
 * contra admin_users. Sessão JWT — sem tabela de sessão no banco.
 */
export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Painel Mi Ozorio",
      credentials: {
        email: { label: "E-mail", type: "email" },
        password: { label: "Senha", type: "password" },
      },
      async authorize(credentials) {
        const email = credentials?.email?.trim().toLowerCase();
        const password = credentials?.password;
        if (!email || !password) return null;

        const user = await prisma.adminUser.findUnique({ where: { email } });
        if (!user || !user.active) return null;

        // M13.2 — conta travada por brute-force: recusa sem nem checar a senha.
        if (user.lockedUntil && user.lockedUntil > new Date()) return null;

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
          return null;
        }

        // Sucesso: zera o contador (só escreve se havia o que limpar).
        if (user.failedAttempts > 0 || user.lockedUntil) {
          await prisma.adminUser.update({
            where: { id: user.id },
            data: { failedAttempts: 0, lockedUntil: null },
          });
        }

        return { id: user.id, email: user.email, name: user.name };
      },
    }),
  ],
  session: { strategy: "jwt", maxAge: 12 * 60 * 60 },
  pages: { signIn: "/admin/login" },
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
