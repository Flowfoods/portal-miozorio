import { withAuth } from "next-auth/middleware";

/**
 * Protege todo o /admin (M5). A página de login (pages.signIn) é liberada
 * pelo próprio withAuth. As rotas /api/* admin têm guarda própria
 * (requireAdmin) — defesa em profundidade.
 */
export default withAuth({
  pages: { signIn: "/admin/login" },
});

export const config = {
  matcher: ["/admin/:path*"],
};
