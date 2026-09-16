import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/auth";
import {
  HEADER_CAMINHO,
  caminhoSeguro,
  loginComRetorno,
} from "@/lib/auth-rotas";

/**
 * Guarda de PÁGINA do painel (B4). Confere a sessão no banco — `tokenVersion`
 * e conta ativa, pelo callback `session` do NextAuth — e, se ela morreu,
 * manda para o login com o caminho de volta.
 *
 * Por que no topo de CADA página, se o `admin/layout.tsx` já confere: o App
 * Router não roda o layout de novo em navegação interna (`<Link>`) — só a
 * página. Sem isto, uma sessão derrubada (senha trocada em outro aparelho)
 * seguia navegando pelo painel até um recarregamento ou o JWT vencer (7 dias).
 * `tests/auth-painel.test.ts` varre o painel e falha se uma página nascer sem
 * a chamada.
 *
 * Por que não `requireAdmin()`: ele LANÇA — certo para server action e rota
 * de API, errado para página, onde viraria a tela "Ops, algo deu errado" do
 * `error.tsx` em vez de devolver a Mi para o login.
 *
 * O caminho de volta vem do header que o middleware injeta em toda request
 * (inclusive nas de navegação interna) e passa por `caminhoSeguro`: header
 * hostil vira login seco, nunca open redirect.
 */
export async function exigirSessaoDoPainel() {
  const sessao = await getAdminSession();
  if (sessao?.user?.email) return sessao;
  const caminho = headers().get(HEADER_CAMINHO) ?? "";
  const destino = caminhoSeguro(caminho, "");
  redirect(destino ? loginComRetorno("/admin/login", destino) : "/admin/login");
}
