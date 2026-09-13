import {
  NextResponse,
  type NextFetchEvent,
  type NextRequest,
} from "next/server";
import { withAuth, type NextRequestWithAuth } from "next-auth/middleware";
import { destinoCanonico } from "@/lib/auth-cookies";
import { HEADER_CAMINHO } from "@/lib/auth-rotas";

/** Rotas do /admin liberadas sem sessão (login + fluxo de recuperação — M13.4). */
const PUBLIC_ADMIN = ["/admin/login", "/admin/recuperar"];

/**
 * Protege todo o /admin (M5). Login e o fluxo de redefinição de senha
 * (M13.4) ficam públicos. As rotas /api/* admin têm guarda própria
 * (requireAdmin) — defesa em profundidade.
 */
const guardaAdmin = withAuth({
  callbacks: {
    authorized: ({ req, token }) => {
      const { pathname } = req.nextUrl;
      if (PUBLIC_ADMIN.includes(pathname)) return true;
      return !!token;
    },
  },
  pages: { signIn: "/admin/login" },
});

/**
 * B1 — DOMÍNIO CANÔNICO. Os cookies de sessão (o `mi_clube` da cliente e os do
 * NextAuth, que usam o prefixo `__Host-` e por definição não aceitam `Domain`)
 * valem só no host exato em que foram gravados. Sem isto, quem entrava em
 * `miozorio.com.br` e depois abria `www.miozorio.com.br` aparecia deslogada —
 * e, pior, as Server Actions do Next recusam o POST quando o `Origin` não bate
 * com o host encaminhado pelo Traefik: o login simplesmente não acontecia, com
 * a senha certa.
 *
 * Redireciona 308 (preserva método e corpo) para o host de
 * `AUTH_CANONICAL_HOST` (ou o host de `NEXT_PUBLIC_SITE_URL`). localhost e o
 * preview do Dokploy (*.traefik.me) ficam de fora — preview não é para cliente.
 */
function redirecionarCanonico(req: NextRequest): NextResponse | null {
  const hostAtual =
    req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  const destino = destinoCanonico(hostAtual);
  if (!destino) return null;
  const url = req.nextUrl.clone();
  url.host = destino;
  url.port = "";
  url.protocol = "https:";
  return NextResponse.redirect(url, 308);
}

export default function middleware(req: NextRequest, event: NextFetchEvent) {
  const canonico = redirecionarCanonico(req);
  if (canonico) return canonico;
  if (req.nextUrl.pathname.startsWith("/admin")) {
    return guardaAdmin(req as NextRequestWithAuth, event);
  }
  // B5 — o caminho pedido viaja num header para o servidor montar o link de
  // login com `callbackUrl`: depois de entrar, a cliente volta para a página
  // que ela queria, não para a home.
  const headers = new Headers(req.headers);
  headers.set(HEADER_CAMINHO, `${req.nextUrl.pathname}${req.nextUrl.search}`);
  return NextResponse.next({ request: { headers } });
}

export const config = {
  // O redirect canônico precisa valer no site inteiro (a cliente chega pelo
  // link do Instagram em qualquer página), menos o que o navegador busca em
  // paralelo — asset estático não muda de domínio sozinho e redirecioná-lo só
  // adiciona latência.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|media/|robots.txt|sitemap.xml|manifest.webmanifest).*)",
  ],
};
