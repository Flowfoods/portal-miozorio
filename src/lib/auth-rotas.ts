/**
 * Para onde mandar a pessoa depois de entrar (B5). Módulo PURO — usado no
 * servidor (server actions) e no cliente (formulários), sem arrastar Prisma.
 *
 * Regra de ouro: só caminho do próprio site. Aceitar URL absoluta aqui viraria
 * open redirect — o link "entre na sua conta" de um golpe levaria a cliente
 * para fora do portal depois de ela digitar a senha.
 */

/** Nunca mandar de volta para uma tela de auth (loop) nem para fora do site. */
const PROIBIDOS = [
  "/clube/entrar",
  "/clube/recuperar",
  "/admin/login",
  "/admin/recuperar",
];

export function caminhoSeguro(
  bruto: string | null | undefined,
  padrao: string,
): string {
  const v = (bruto ?? "").trim();
  if (!v) return padrao;
  // "/" simples sim; "//evil.com" e "/\evil.com" não (o navegador lê como host).
  if (!v.startsWith("/") || v.startsWith("//") || v.startsWith("/\\")) {
    return padrao;
  }
  if (v.includes("://") || /[\r\n]/.test(v)) return padrao;
  const caminho = v.split("?")[0] ?? v;
  if (PROIBIDOS.some((p) => caminho === p)) return padrao;
  return v;
}

/** Header que o middleware injeta com o caminho pedido (B5). */
export const HEADER_CAMINHO = "x-mi-caminho";

/** Monta o link de login preservando a página que a pessoa tentava abrir. */
export function loginComRetorno(entrarHref: string, destino: string): string {
  return `${entrarHref}?callbackUrl=${encodeURIComponent(destino)}`;
}
