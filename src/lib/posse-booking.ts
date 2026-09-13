import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * POSSE DA RESERVA — quem pode chamar `POST /api/bookings/:id/confirm`.
 *
 * O problema: a rota de confirmação não checava quem chamava. Qualquer pessoa
 * com o UUID de uma reserva podia confirmá-la. O dano é contido por desenho
 * (a rota fixa o ator em `system`, então hold vencido é recusado e o sinal
 * continua exigido), mas "ninguém checa" não é uma propriedade que se queira
 * manter numa rota pública de escrita.
 *
 * A solução: na CRIAÇÃO, o servidor assina um comprovante de posse e devolve
 * num cookie httpOnly. A confirmação exige esse comprovante. Nada é guardado no
 * banco — a assinatura basta.
 *
 * ── Por que FALHA ABERTO se não houver segredo ───────────────────────────────
 * Sem `NEXTAUTH_SECRET`, `chave()` devolve null e a checagem é PULADA: o
 * comportamento volta a ser exatamente o de hoje.
 *
 * Isso é deliberado e é o oposto da escolha feita no webhook de pagamento, que
 * falha FECHADO. A diferença é a assimetria do dano:
 *
 *   webhook sem verificação → qualquer um marca uma reserva como PAGA (grave);
 *   posse sem verificação   → alguém que adivinhou um UUID v4 confirma uma
 *                             reserva que a cliente já queria confirmar,
 *                             sem escapar do sinal nem do hold (leve).
 *
 * Já falhar fechado aqui derrubaria TODAS as confirmações por uma env ausente,
 * no caminho que gera receita. Entre "proteção some" e "ninguém agenda", a
 * conta pende para o primeiro — e este comentário existe para que a escolha
 * seja revisada de propósito, não descoberta por acidente.
 */

/** Nome do cookie. Curto: ele viaja em toda requisição do site. */
export const COOKIE_POSSE = "mi_reserva";

/**
 * Quantas reservas o cookie carrega. Mais de uma porque a mesma pessoa pode
 * agendar de novo sem ter confirmado a anterior — e perder a posse da primeira
 * por causa disso seria transformar a proteção em bug.
 */
export const MAX_POSSES = 5;

const SEPARADOR = "~";

/**
 * Chave derivada do `NEXTAUTH_SECRET` com rótulo de separação de domínio: a
 * mesma origem, usos distintos. Sem env nova — a lição do `MI_WHATSAPP` foi
 * que env nova é env que alguém esquece de configurar.
 */
function chave(): string | null {
  const base = process.env.NEXTAUTH_SECRET?.trim();
  return base ? `posse-booking:v1:${base}` : null;
}

/** A verificação está ligada? Falso = sem segredo, comportamento antigo. */
export function posseAtiva(): boolean {
  return chave() !== null;
}

function assinar(bookingId: string, expEpochMs: number, k: string): string {
  return createHmac("sha256", k)
    .update(`${bookingId}:${expEpochMs}`)
    .digest("base64url");
}

function iguais(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

/**
 * Comprovante para uma reserva: `bookingId.exp.assinatura`.
 * Devolve null quando não há segredo (a checagem fica desligada).
 */
export function emitirPosse(
  bookingId: string,
  validoAteMs: number,
): string | null {
  const k = chave();
  if (!k) return null;
  const exp = Math.floor(validoAteMs);
  return `${bookingId}.${exp}.${assinar(bookingId, exp, k)}`;
}

/** Junta o comprovante novo aos que já estavam no cookie, sem duplicar. */
export function empilharPosse(
  cookieAtual: string | null | undefined,
  novo: string,
): string {
  const idNovo = novo.split(".")[0];
  const anteriores = (cookieAtual ?? "")
    .split(SEPARADOR)
    .filter((t) => t.includes(".") && t.split(".")[0] !== idNovo);
  return [novo, ...anteriores].slice(0, MAX_POSSES).join(SEPARADOR);
}

/**
 * O cookie prova a posse desta reserva, agora?
 *
 * Devolve `true` também quando a verificação está desligada (sem segredo) —
 * ver o bloco sobre falhar aberto no topo do arquivo.
 */
export function temPosse(
  cookieAtual: string | null | undefined,
  bookingId: string,
  agoraMs: number = Date.now(),
): boolean {
  const k = chave();
  if (!k) return true; // verificação desligada
  if (!cookieAtual) return false;

  for (const token of cookieAtual.split(SEPARADOR)) {
    const partes = token.split(".");
    if (partes.length !== 3) continue;
    const [id, expBruto, sig] = partes as [string, string, string];
    if (id !== bookingId) continue;
    const exp = Number(expBruto);
    if (!Number.isFinite(exp) || exp <= agoraMs) continue;
    if (iguais(sig, assinar(id, exp, k))) return true;
  }
  return false;
}

/**
 * Mensagem do 403. NÃO diz "não consegui confirmar": a reserva está guardada, e
 * o erro seco foi exatamente o que fez a cliente do caso original achar que não
 * tinha agendado e ir atrás da Mi por fora.
 */
export const MSG_SEM_POSSE =
  "Seu horário está guardado 💛 Só não consegui confirmar por aqui — a Mi fala com você pelo WhatsApp para fechar.";
