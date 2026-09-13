"use server";

import { redirect } from "next/navigation";
import { caminhoSeguro } from "@/lib/auth-rotas";

import {
  RECUP_NEUTRO,
  pedirCodigo,
  salvarNovaSenha,
  verificarCodigo,
} from "@/lib/recuperacao";
import type {
  PedirState,
  SalvarState,
  VerificarState,
} from "@/lib/recuperacao-tipos";

/**
 * Server actions da recuperação de senha — as MESMAS para a cliente e para o
 * painel (B2: modelo único). O passo 1 sempre "dá certo" na UI: a existência da
 * conta nunca vaza na resposta.
 */

export async function pedirCodigoAction(
  _prev: PedirState,
  formData: FormData,
): Promise<PedirState> {
  const identificador = String(formData.get("identificador") ?? "").trim();
  if (!identificador) return { error: "Digite seu WhatsApp ou e-mail." };
  await pedirCodigo(identificador);
  return { ok: true, identificador, aviso: RECUP_NEUTRO };
}

export async function verificarCodigoAction(
  _prev: VerificarState,
  formData: FormData,
): Promise<VerificarState> {
  const r = await verificarCodigo(
    String(formData.get("identificador") ?? ""),
    String(formData.get("codigo") ?? ""),
  );
  return r.ok ? { ok: true } : { error: r.message, pedirNovo: r.pedirNovo };
}

export async function salvarSenhaAction(
  _prev: SalvarState,
  formData: FormData,
): Promise<SalvarState> {
  const r = await salvarNovaSenha(String(formData.get("senha") ?? ""));
  if (!r.ok) return { error: r.message, pedirNovo: r.pedirNovo };

  // Cliente: a sessão já está de pé (cookie gravado pelo módulo), então quem
  // navega é o SERVIDOR — o mesmo caminho do login. Deixar isso para um
  // `router.replace` no cliente é mais frágil: se o efeito não roda (aba em
  // segundo plano, hidratação lenta), a pessoa fica olhando para a tela da
  // senha achando que não salvou, mesmo já tendo salvado.
  if (r.perfil === "cliente") {
    redirect(
      caminhoSeguro(String(formData.get("destino") ?? ""), "/clube/conta"),
    );
  }

  // Painel: a sessão é do NextAuth e só o navegador consegue abri-la, então
  // aqui devolvemos o e-mail para a tela entrar com a senha recém-criada.
  return { ok: true, perfil: r.perfil, email: r.email };
}
