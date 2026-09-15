import { normalizeE164BR } from "./phone";

/**
 * Fonte ÚNICA de normalização de credenciais (B1). Cadastro e login precisam
 * chegar exatamente ao mesmo valor — antes, cada tela normalizava do seu jeito
 * e a cliente que digitava o telefone num formato diferente do cadastrado
 * simplesmente não entrava, com a senha certa.
 *
 * Regras:
 *  - telefone → E.164 (+55DDDNNNNNNNNN), só dígitos (R5);
 *  - e-mail   → minúsculas + trim;
 *  - senha    → trim SÓ nas pontas. Nunca mexer no meio, nunca limitar
 *               caracteres: teclado de celular acrescenta espaço ao aceitar a
 *               sugestão do corretor e colar senha costuma trazer espaço junto.
 */

/** Mínimo de caracteres da senha da cliente (portal do Clube). */
export const SENHA_MIN_CLIENTE = 6;

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/** Só as pontas: o meio da senha é sagrado (pode ter espaço de propósito). */
export function normalizarSenha(raw: string | null | undefined): string {
  return (raw ?? "").trim();
}

/** E-mail canônico: minúsculas + trim (o servidor de e-mail não diferencia). */
export function normalizarEmail(raw: string | null | undefined): string {
  return (raw ?? "").trim().toLowerCase();
}

export function emailValido(raw: string): boolean {
  return EMAIL_RE.test(normalizarEmail(raw));
}

/** Telefone canônico (E.164) ou null se não for um número brasileiro válido. */
export function normalizarTelefone(
  raw: string | null | undefined,
): string | null {
  return raw ? normalizeE164BR(raw) : null;
}

/**
 * A senha escolhida é o próprio telefone? Compara com e SEM o DDI: o telefone
 * fica em E.164 (+5521998626845), mas ninguém digita "55" na frente da senha —
 * e "21998626845" é exatamente a senha provisória do primeiro acesso. Comparar
 * só a forma completa deixava passar justamente a versão adivinhável.
 */
export function ehOProprioTelefone(
  senha: string,
  telefoneE164: string,
): boolean {
  const s = senha.trim();
  // Conta como "o telefone" tudo que é só jeito de escrever telefone: dígitos
  // e a pontuação que o site e o WhatsApp usam — "(21) 99862-6845",
  // "+55 21 99862-6845", "21 99862 6845". Antes, qualquer caractere que não
  // fosse dígito liberava, e a forma FORMATADA (a que a cliente vê na
  // carteirinha e na mensagem da Mi) passava como senha nova.
  if (!s || !/^[\d\s()\-.+]+$/.test(s)) return false;
  const d = (x: string) => x.replace(/\D/g, "");
  const senhaDigitos = d(s);
  if (!senhaDigitos) return false;
  const tel = d(telefoneE164);
  return senhaDigitos === tel || senhaDigitos === tel.replace(/^55/, "");
}

export type Identificador =
  | { tipo: "telefone"; valor: string }
  | { tipo: "email"; valor: string };

/**
 * Descobre se a pessoa digitou telefone ou e-mail e devolve o valor canônico.
 * Serve os dois portais: a cliente entra por telefone, a Mi por e-mail, e a
 * recuperação de senha aceita os dois sem a pessoa precisar saber qual é qual.
 */
export function identificarLogin(raw: string): Identificador | null {
  const bruto = (raw ?? "").trim();
  if (!bruto) return null;
  if (bruto.includes("@")) {
    const email = normalizarEmail(bruto);
    return emailValido(email) ? { tipo: "email", valor: email } : null;
  }
  const tel = normalizarTelefone(bruto);
  return tel ? { tipo: "telefone", valor: tel } : null;
}
