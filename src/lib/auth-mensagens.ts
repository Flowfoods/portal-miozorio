/**
 * Mensagens de erro de login do painel — módulo PURO (sem Prisma/bcrypt) porque
 * a tela de login é client component e não pode arrastar o servidor no bundle.
 *
 * O `authorize` do NextAuth só consegue devolver uma string para o cliente
 * (`error.message` vira `?error=`), então o que viaja é um CÓDIGO curto: nunca
 * e-mail, nunca senha, nunca "essa conta existe".
 */

/** Rate-limit por IP estourado. */
export const ERRO_THROTTLED = "MUITAS_TENTATIVAS";
/** Conta pausada por tentativas seguidas: `CONTA_PAUSADA:<minutos>`. */
export const ERRO_LOCKED = "CONTA_PAUSADA";

export function codigoLocked(ate: Date, agora = new Date()): string {
  const min = Math.max(1, Math.ceil((ate.getTime() - agora.getTime()) / 60_000));
  return `${ERRO_LOCKED}:${min}`;
}

/**
 * Traduz o código do NextAuth para a voz da Mi. Qualquer coisa desconhecida
 * (inclusive o `CredentialsSignin` padrão) cai na mensagem única — que não
 * diferencia "e-mail não existe" de "senha errada".
 */
export function mensagemLoginAdmin(codigo: string | null | undefined): string {
  if (!codigo) return "E-mail ou senha incorretos. Tente novamente 🤎";
  if (codigo === ERRO_THROTTLED) {
    return "Muitas tentativas seguidas por aqui. Espere alguns minutos e tente de novo.";
  }
  if (codigo.startsWith(`${ERRO_LOCKED}:`)) {
    const min = Number(codigo.split(":")[1]) || 1;
    return `Conta pausada por segurança. Tente de novo em ${min} min — ou peça um código pelo "Esqueci a senha".`;
  }
  return "E-mail ou senha incorretos. Tente novamente 🤎";
}
