import type { CodigoDoAdmin, Perfil } from "./recuperacao";

/**
 * Estados dos três passos da recuperação de senha. Vivem fora do arquivo de
 * server actions porque um módulo "use server" só pode exportar função async.
 */

export type PedirState =
  | { ok: true; identificador: string; aviso: string }
  | { error: string }
  | null;

export type VerificarState =
  | { ok: true }
  | { error: string; pedirNovo?: boolean }
  | null;

export type SalvarState =
  | { ok: true; perfil: Perfil; email: string | null }
  | { error: string; pedirNovo?: boolean }
  | null;

/** Código gerado pela Mi na ficha da cliente (aba Clientes). */
export type CodigoRecuperacaoState =
  | { ok: CodigoDoAdmin }
  | { error: string }
  | null;
