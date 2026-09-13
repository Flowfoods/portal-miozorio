/**
 * Atributos dos cookies de autenticação (B1) — fonte única para os dois portais.
 *
 * Decisões e por quê:
 *  - `SameSite=Lax` (NUNCA `Strict`): a cliente chega por link do WhatsApp/
 *    Instagram; com `Strict` o cookie não viaja na navegação vinda de fora e ela
 *    cai deslogada logo depois de entrar.
 *  - `HttpOnly` sempre: nenhum script lê a sessão.
 *  - `Secure` em produção (em dev sem TLS o cookie precisa viajar em http).
 *  - `Path=/`: o cookie tem que valer no site inteiro, não só num prefixo — foi
 *    exatamente o que queimou o "vale" da recuperação de senha (gravado em
 *    `/clube`, apagado em `/`, ou seja: nunca apagado de verdade).
 *  - `Domain` só quando `AUTH_COOKIE_DOMAIN` existe. O padrão é host-only e o
 *    caminho oficial para apex×www é o REDIRECT CANÔNICO do middleware — os
 *    cookies do NextAuth usam o prefixo `__Host-`, que proíbe `Domain`, então
 *    espalhar o cookie da cliente por subdomínio deixaria os dois portais com
 *    comportamentos diferentes. A env fica como escape hatch documentado.
 */

export interface OpcoesCookie {
  httpOnly: true;
  secure: boolean;
  sameSite: "lax";
  path: "/";
  maxAge: number;
  domain?: string;
}

/** Sessão da cliente: 30 dias, com renovação deslizante a cada ação. */
export const TTL_SESSAO_CLIENTE_MS = 30 * 24 * 60 * 60 * 1000;
/** Sessão do painel (NextAuth): 7 dias — acesso privilegiado vive menos. */
export const TTL_SESSAO_ADMIN_S = 7 * 24 * 60 * 60;

export function cookieSeguro(): boolean {
  return process.env.NODE_ENV === "production";
}

/** `Domain` configurado (ex.: ".miozorio.com.br") ou undefined = host-only. */
export function dominioCookie(): string | undefined {
  const d = process.env.AUTH_COOKIE_DOMAIN?.trim();
  return d || undefined;
}

export function opcoesCookie(maxAgeMs: number): OpcoesCookie {
  const base: OpcoesCookie = {
    httpOnly: true,
    secure: cookieSeguro(),
    sameSite: "lax",
    path: "/",
    maxAge: Math.floor(maxAgeMs / 1000),
  };
  const domain = dominioCookie();
  return domain ? { ...base, domain } : base;
}

/**
 * Host canônico do portal (`AUTH_CANONICAL_HOST`, ou o host de
 * `NEXT_PUBLIC_SITE_URL`). Vazio = não redirecionar (dev, preview do Dokploy).
 * `AUTH_CANONICAL_HOST="off"` é o desligamento de emergência: se algum dia o
 * Traefik reescrever o Host e o redirect entrar em laço, essa env resolve sem
 * precisar de deploy de código.
 */
export function hostCanonico(): string | null {
  const explicito = process.env.AUTH_CANONICAL_HOST?.trim();
  if (explicito?.toLowerCase() === "off") return null;
  if (explicito)
    return explicito.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  const site = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (!site) return null;
  try {
    return new URL(site).host;
  } catch {
    return null;
  }
}

/** Hosts que nunca são redirecionados (dev e preview interno). */
export function hostIsento(host: string): boolean {
  const semPorta = host.split(":")[0] ?? host;
  return (
    semPorta === "localhost" ||
    semPorta === "127.0.0.1" ||
    semPorta.endsWith(".traefik.me") ||
    semPorta.endsWith(".localhost")
  );
}

/**
 * Decide o redirect para o domínio canônico. Puro (testável): recebe o host do
 * request e devolve o host de destino, ou null se já está certo/é isento.
 */
export function destinoCanonico(
  hostAtual: string | null | undefined,
  canonico: string | null = hostCanonico(),
): string | null {
  if (!hostAtual || !canonico) return null;
  if (hostIsento(hostAtual)) return null;
  if (hostAtual.toLowerCase() === canonico.toLowerCase()) return null;
  return canonico;
}
