import { withAuth } from "next-auth/middleware";

/** Rotas do /admin liberadas sem sessão (login + fluxo de recuperação — M13.4). */
const PUBLIC_ADMIN = ["/admin/login", "/admin/recuperar"];

/**
 * Protege todo o /admin (M5). Login e o fluxo de redefinição de senha
 * (M13.4) ficam públicos. As rotas /api/* admin têm guarda própria
 * (requireAdmin) — defesa em profundidade.
 */
export default withAuth({
  callbacks: {
    authorized: ({ req, token }) => {
      const { pathname } = req.nextUrl;
      if (
        PUBLIC_ADMIN.includes(pathname) ||
        pathname.startsWith("/admin/redefinir")
      ) {
        return true;
      }
      return !!token;
    },
  },
  pages: { signIn: "/admin/login" },
});

export const config = {
  matcher: ["/admin/:path*"],
};
