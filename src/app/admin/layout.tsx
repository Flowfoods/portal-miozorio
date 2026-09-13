import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import AdminShell from "@/components/admin/AdminShell";
import { contarMomentosPendentes } from "@/lib/momentos";
import { getAdminSession } from "@/lib/auth";
import {
  HEADER_CAMINHO,
  caminhoSeguro,
  loginComRetorno,
} from "@/lib/auth-rotas";

export const metadata: Metadata = {
  title: "Painel · Mi Ozorio",
  robots: { index: false, follow: false },
};

// Contagem fresca a cada carga (badge de pendências); a moderação revalida.
export const dynamic = "force-dynamic";

/** Telas de antes do login — não passam pela guarda de sessão. */
const PUBLICAS = ["/admin/login", "/admin/recuperar"];

export default async function AdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // B4 — o middleware só sabe se o JWT é válido; ele não tem como conferir no
  // banco se a senha foi trocada desde então (roda no Edge, sem Prisma). Com
  // isso, a sessão derrubada em outro aparelho passava pelo middleware e
  // morria lá dentro, no `requireAdmin`, mostrando TELA DE ERRO em vez de
  // devolver a Mi para o login. A conferência de verdade é aqui.
  const caminho = headers().get(HEADER_CAMINHO) ?? "";
  const rota = caminho.split("?")[0] ?? "";
  // Sem o header (middleware fora do ar, rota fora do matcher) tratamos como
  // pública: o `requireAdmin` de cada página/action continua protegendo, e
  // é melhor degradar para a tela antiga do que trancar a Mi para fora.
  const publica =
    !rota || PUBLICAS.some((p) => rota === p || rota.startsWith(`${p}/`));

  if (!publica) {
    const sessao = await getAdminSession();
    if (!sessao?.user?.email) {
      const destino = caminhoSeguro(caminho, "");
      redirect(
        destino ? loginComRetorno("/admin/login", destino) : "/admin/login",
      );
    }
  }

  const pendentes = await contarMomentosPendentes();
  return (
    <AdminShell badges={{ "/admin/depoimentos": pendentes }}>
      {children}
    </AdminShell>
  );
}
