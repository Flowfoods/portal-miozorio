import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { getClienteSession } from "@/lib/cliente-auth";
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
 * `/confirm` e `/sinal` não possam divergir — as duas importam daqui.
 *
 * O `code: "sem_posse"` é o mesmo nas duas rotas de propósito: é a mesma recusa,
 * e a tela pode tratá-la num lugar só.
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

  const sessao = await getClienteSession();
  if (!sessao) return false;
  // `id` vem da URL: um valor que não é UUID faz o Prisma recusar a consulta, e
  // recusa é a resposta certa aqui de qualquer jeito.
  const reserva = await prisma.booking
    .findUnique({ where: { id }, select: { customerId: true } })
    .catch(() => null);
  return sessaoEDona(sessao, reserva?.customerId);
}
