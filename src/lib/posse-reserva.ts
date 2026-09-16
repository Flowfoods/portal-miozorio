import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Posse de uma reserva pública — quem criou é quem confirma.
 *
 * `POST /api/bookings/:id/confirm` é rota pública e confirmava qualquer reserva
 * pendente que recebesse. O único segredo era o UUID da reserva, e ele viaja na
 * resposta da criação: quem tivesse o id na mão (print, histórico de navegador
 * compartilhado, log de proxy) confirmava a reserva de outra pessoa.
 *
 * O comprovante é um HMAC-SHA256 do próprio id + validade, entregue num cookie
 * httpOnly na criação e exigido na confirmação. **Não é sessão**: não diz quem
 * é a pessoa, não vale para outra reserva e morre junto com o horário guardado.
 * Por isso é assinado e não sorteado — nada de novo no banco, nada a limpar
 * depois, e um comprovante vazado não abre nenhuma outra porta.
 *
 * O segredo é o mesmo `NEXTAUTH_SECRET` que já assina a sessão da cliente
 * (`cliente-auth.ts`): girar o segredo derruba os comprovantes em aberto, que é
 * o comportamento certo — no pior caso a Mi confirma pelo painel.
 */

const PREFIXO = "mi_posse_";

/**
 * Um cookie por reserva. A cliente pode ter duas em aberto ao mesmo tempo
 * (`MAX_PENDING_POR_TELEFONE`); um cookie único guardaria só a última e
 * confirmar a primeira passaria a falhar.
 */
export function nomeCookiePosse(bookingId: string): string {
  return `${PREFIXO}${bookingId}`;
}

/**
 * Folga entre a morte do horário guardado e a do comprovante. Existe para que
 * quem chegar atrasado leia "o tempo da reserva expirou" (410, que explica o
 * que houve) em vez de "não consegui confirmar por aqui" (403, que é a
 * resposta para quem não é dono). Dentro do hold o comprovante é sempre válido.
 */
export const FOLGA_POSSE_MS = 30 * 60_000;

function segredo(): string {
  const s = process.env.NEXTAUTH_SECRET;
  if (!s) throw new Error("NEXTAUTH_SECRET ausente");
  return s;
}

function assinar(dados: string): string {
  return createHmac("sha256", segredo()).update(dados).digest("base64url");
}

function iguais(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  // A guarda de tamanho é obrigatória: timingSafeEqual LANÇA com buffers de
  // tamanhos diferentes, e um comprovante truncado viraria erro 500.
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

/** Até quando o comprovante vale, dado o fim do horário guardado. */
export function validadeDaPosse(holdExpiresAt: string | Date | null): Date {
  const fim =
    holdExpiresAt instanceof Date
      ? holdExpiresAt.getTime()
      : Date.parse(holdExpiresAt ?? "");
  const base = Number.isFinite(fim) ? fim : Date.now();
  return new Date(base + FOLGA_POSSE_MS);
}

/** Comprovante de posse: `<validade em ms>.<hmac(id.validade)>`. */
export function assinarPosse(bookingId: string, validade: Date): string {
  const exp = validade.getTime();
  return `${exp}.${assinar(`${bookingId}.${exp}`)}`;
}

/**
 * Confere o comprovante contra ESTA reserva. Nunca lança: entrada lixo, cookie
 * truncado ou assinatura adulterada são todos `false`, porque a resposta certa
 * para qualquer um deles é a mesma — não é dono.
 */
export function verificarPosse(
  token: string | null | undefined,
  bookingId: string,
  agora: Date = new Date(),
): boolean {
  if (!token) return false;
  const [expBruto, assinatura] = token.split(".");
  if (!expBruto || !assinatura) return false;
  const exp = Number(expBruto);
  if (!Number.isFinite(exp) || exp <= agora.getTime()) return false;
  // A assinatura cobre o id: comprovante de uma reserva não confirma outra.
  return iguais(assinatura, assinar(`${bookingId}.${exp}`));
}
