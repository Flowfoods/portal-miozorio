import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { getClienteSession, type ClienteSession } from "@/lib/cliente-auth";
import {
  nomeCookiePosse,
  sessaoEDona,
  verificarPosse,
} from "@/lib/posse-reserva";

/**
 * Guarda de posse das rotas públicas de uma reserva.
 *
 * `posse-reserva.ts` é puro (só `node:crypto`) e guarda as DECISÕES. Este
 * módulo é o lado de fora: lê cookie, sessão e banco, na ordem que importa.
 * Ficam separados para que o teste da decisão não precise de Prisma e para que
 * as três rotas sob `[id]` — `/confirm`, `/sinal` e o `GET` da própria reserva —
 * não possam divergir: todas importam daqui.
 *
 * O `code: "sem_posse"` é o mesmo nas três de propósito: é a mesma recusa, e a
 * tela pode tratá-la num lugar só.
 */
export const CODIGO_SEM_POSSE = "sem_posse";

/**
 * Quem pode agir nesta reserva: quem a criou (comprovante de posse emitido na
 * criação) ou a cliente logada no Clube que é dona dela.
 *
 * Chamar SEMPRE antes de buscar a reserva. O 403 vindo antes de qualquer
 * consulta é o que impede a rota de virar oráculo: sondar UUIDs ao acaso não
 * distingue reserva que existe de reserva que não existe.
 */
export async function temPosseDaReserva(id: string): Promise<boolean> {
  try {
    if (verificarPosse(cookies().get(nomeCookiePosse(id))?.value, id))
      return true;
  } catch (e) {
    // `verificarPosse` não lança por entrada ruim — só por segredo ausente, que
    // é erro de configuração. Vira "não é dona" (403, que tem caminho de saída)
    // em vez de 500 em cima de uma reserva que está de pé.
    console.error("posse: não consegui conferir o comprovante", id, e);
  }

  let sessao: ClienteSession | null;
  try {
    sessao = await getClienteSession();
  } catch (e) {
    // Mesma regra do comprovante. `getClienteSession` lança quando o segredo
    // sumiu e há cookie do Clube no navegador; sem este try, as três rotas
    // responderiam 500 nesse estado. Configuração quebrada vira "não é dona"
    // (403, que tem caminho de saída pela Mi), nunca 500.
    console.error("posse: não consegui ler a sessão do Clube", id, e);
    return false;
  }
  // Sem sessão, ou com a provisória, a resposta já é "não" — e a RESERVA não é
  // consultada. É essa consulta que o 403 não pode depender, porque é ela que
  // usaria o UUID da URL; a que `getClienteSession` faz acima é em `customer`,
  // pelo id da própria sessão, e não conta nada sobre a reserva de ninguém.
  // `sessaoEDona` confere a provisória de novo, de propósito — a decisão pura
  // tem que ficar completa sozinha, sem depender de quem a chama ter filtrado.
  if (!sessao || sessao.prov) return false;
  // `id` vem da URL: um valor que não é UUID faz o Prisma recusar a consulta, e
  // recusa é a resposta certa aqui de qualquer jeito.
  const reserva = await prisma.booking
    .findUnique({ where: { id }, select: { customerId: true } })
    .catch(() => null);
  return sessaoEDona(sessao, reserva?.customerId);
}
