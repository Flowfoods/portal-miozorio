import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { gatewayAtivo } from "@/lib/pagamento";
import { getSettings } from "@/lib/settings";
import {
  CODIGO_SEM_POSSE,
  temPosseDaReserva,
} from "@/lib/posse-reserva-guarda";

export const dynamic = "force-dynamic";

/**
 * Só quem é dona da reserva mexe no sinal dela — a mesma posse que o `/confirm`
 * exige, pela mesma razão: o id é um UUID que viaja na resposta da criação, não
 * um segredo. Aqui o estrago seria maior que confirmar um horário — quem
 * tivesse o id na mão abriria uma cobrança PIX na reserva de outra pessoa.
 */
async function recusaSemPosse(id: string, erro: string) {
  if (await temPosseDaReserva(id)) return null;
  return NextResponse.json(
    { error: erro, code: CODIGO_SEM_POSSE },
    { status: 403 },
  );
}

/**
 * A7 — cria (ou devolve) a cobrança PIX do sinal de uma reserva.
 *
 * Só existe caminho aqui quando há gateway configurado. Sem ele, devolve 501 e
 * a tela da cliente segue no fluxo do WhatsApp — que é o que acontece hoje.
 *
 * Idempotente por reserva: chamar de novo devolve a MESMA cobrança (o
 * `X-Idempotency-Key` do provedor + o `deposit_payment_id` guardado aqui), em
 * vez de abrir um PIX novo a cada recarga da tela.
 */
export async function POST(
  _req: Request,
  { params }: { params: { id: string } },
) {
  // O gateway vem primeiro de propósito: sem ele a resposta é 501 para todo
  // mundo, sem tocar no banco e sem contar a ninguém se a reserva existe. Trocar
  // a ordem faria um portal sem PIX passar a distinguir dona de estranho.
  const gateway = gatewayAtivo();
  if (!gateway) {
    return NextResponse.json(
      {
        error: "Pagamento pelo portal ainda não está ativo.",
        code: "sem_gateway",
      },
      { status: 501 },
    );
  }

  // Antes do `findUnique`: o 403 não pode depender de a reserva existir, senão
  // a rota vira oráculo de UUID.
  //
  // A frase é curta de propósito: a tela do sinal (`AgendarWizard`) emenda
  // "Seu horário continua guardado — fale com a Mi no WhatsApp" em todo erro
  // do PIX. Repetir o convite aqui deixava dois CTAs na mesma linha.
  const semPosse = await recusaSemPosse(
    params.id,
    "Não consegui gerar o PIX por aqui.",
  );
  if (semPosse) return semPosse;

  const booking = await prisma.booking.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      status: true,
      depositCents: true,
      depositPaidAt: true,
      depositPaymentId: true,
      holdExpiresAt: true,
      customer: { select: { name: true, phoneE164: true, email: true } },
      service: { select: { name: true } },
    },
  });

  if (!booking) {
    return NextResponse.json(
      { error: "Reserva não encontrada." },
      { status: 404 },
    );
  }
  if (booking.status !== "pending") {
    return NextResponse.json(
      {
        error: "Essa reserva não está mais aguardando sinal.",
        code: "not_pending",
      },
      { status: 409 },
    );
  }
  if (booking.depositPaidAt) {
    return NextResponse.json(
      { error: "Sinal já recebido.", code: "ja_pago" },
      { status: 409 },
    );
  }
  if (!booking.depositCents || booking.depositCents <= 0) {
    return NextResponse.json(
      { error: "Essa reserva não tem sinal a pagar.", code: "sem_sinal" },
      { status: 422 },
    );
  }

  // A cobrança vence junto com o horário guardado: um PIX que sobrevive ao hold
  // faria a cliente pagar por um horário que já voltou para a agenda.
  const settings = await getSettings();
  const restanteMin = booking.holdExpiresAt
    ? Math.max(
        5,
        Math.floor((booking.holdExpiresAt.getTime() - Date.now()) / 60_000),
      )
    : settings.depositHoldHours * 60;

  try {
    const cobranca = await gateway.criarCobrancaPix({
      bookingId: booking.id,
      valorCents: booking.depositCents,
      descricao: `Sinal — ${booking.service.name} (Mi Ozorio)`,
      pagadorNome: booking.customer.name,
      pagadorTelefone: booking.customer.phoneE164,
      pagadorEmail: booking.customer.email,
      expiraEmMinutos: restanteMin,
    });

    await prisma.booking.update({
      where: { id: booking.id },
      data: {
        depositProvider: gateway.nome,
        depositPaymentId: cobranca.id,
      },
    });

    return NextResponse.json({
      copiaECola: cobranca.copiaECola,
      qrCodeBase64: cobranca.qrCodeBase64,
      expiraEm: cobranca.expiraEm?.toISOString() ?? null,
      valorCents: booking.depositCents,
    });
  } catch (e) {
    console.error("sinal: falha ao criar cobrança", params.id, e);
    // A reserva continua de pé: o WhatsApp da Mi segue como caminho.
    return NextResponse.json(
      {
        error:
          "Não consegui gerar o PIX agora. Seu horário continua guardado — fale com a Mi no WhatsApp.",
        code: "gateway_falhou",
      },
      { status: 502 },
    );
  }
}

/**
 * Consulta o status — a tela faz poll enquanto a cliente paga.
 *
 * ⚠️ Este GET não tem a guarda de gateway que protege o POST, e por isso é o
 * único lado da rota que já estava ACORDADO sem PIX ligado: qualquer pessoa com
 * um UUID lia `pago`/`confirmado`, e o 404 contra o 200 dizia de graça se a
 * reserva existia. Pouco dano isolado, mas é estado de uma reserva alheia
 * respondido a quem não é dona — a mesma porta do POST, sem tranca.
 *
 * Para a cliente muda pouco: o poll começa com o comprovante no navegador, mas
 * ele vence (hold + 30 min, `FOLGA_POSSE_MS`). Quando isso acontece a tela
 * toma 403 e para, dizendo o que houve — em vez de prometer "confirma sozinha"
 * para sempre (`AgendarWizard`, poll do sinal).
 */
export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const semPosse = await recusaSemPosse(
    params.id,
    "Não consegui acompanhar esse pagamento por aqui.",
  );
  if (semPosse) return semPosse;

  const b = await prisma.booking.findUnique({
    where: { id: params.id },
    select: { status: true, depositPaidAt: true },
  });
  if (!b) {
    return NextResponse.json(
      { error: "Reserva não encontrada." },
      { status: 404 },
    );
  }
  return NextResponse.json({
    pago: b.depositPaidAt != null,
    confirmado: b.status === "confirmed",
  });
}
