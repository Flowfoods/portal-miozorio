import { DateTime } from "luxon";
import { prisma } from "./prisma";
import { sendTransactional } from "./whatsapp/service";
import { formatBRL } from "./format";

/**
 * A4 — avisa a MI (não a cliente) sobre o que acontece na agenda.
 *
 * Até aqui o portal não mandava uma única mensagem para ela: os oito
 * `dispatchEvent` do sistema falam todos com a cliente, e `createBooking`
 * terminava no `return` sem chamar nada. Não era falha de entrega da Evolution
 * — a chamada nunca existiu. Na prática a Mi só descobria um agendamento novo
 * se abrisse o painel por conta própria.
 *
 * Garantias (as mesmas do outbox, que já existia pronto):
 *  - Idempotente (R10): dedupeKey `mi:<evento>:<bookingId>` — reprocessar o
 *    cron ou clicar duas vezes não manda a mesma mensagem de novo.
 *  - Retry + log: a mensagem vira linha em `whatsapp_message`, com status,
 *    tentativas e erro, consultável em /admin/mensagens.
 *  - Best-effort: NUNCA lança para quem chamou. Um WhatsApp que não sai não
 *    pode derrubar a criação de um agendamento.
 *  - Env-gated: sem Evolution configurada, vira no-op silencioso.
 */

export type EventoMi =
  | "nova_reserva"
  | "aguardando_sinal"
  | "aguardando_tamanho"
  | "sinal_pago"
  | "confirmado"
  | "cancelado_cliente"
  | "expirado";

const TITULO: Record<EventoMi, string> = {
  nova_reserva: "✨ Novo agendamento",
  aguardando_sinal: "⏳ Reserva aguardando sinal",
  aguardando_tamanho: "📸 Confira o tamanho e aprove",
  sinal_pago: "💰 Sinal recebido",
  confirmado: "✅ Agendamento confirmado",
  cancelado_cliente: "❌ A cliente cancelou",
  expirado: "⌛ Reserva expirou (ninguém cancelou)",
};

/**
 * Número da Mi, só dígitos. `WHATSAPP_MI` costuma vir como URL do wa.me —
 * extrair os dígitos cobre as duas formas.
 */
export function numeroDaMi(): string {
  return (process.env.WHATSAPP_MI ?? "5521970225231").replace(/\D/g, "");
}

function baseUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL ?? "https://miozorio.com.br";
}

/**
 * Monta o texto. Função separada e exportada para poder ser testada sem banco
 * e sem rede — o mesmo padrão de `buildEventMessage` em notify.ts.
 */
export function montarMensagemMi(evento: EventoMi, d: DadosMi): string {
  const quando = DateTime.fromJSDate(d.startsAt)
    .setZone("America/Sao_Paulo")
    .setLocale("pt-BR")
    .toFormat("cccc, dd/LL 'às' HH:mm");
  const linhas = [
    TITULO[evento],
    "",
    `${d.clienteNome} · ${d.clienteTelefone}`,
    `${d.servico}`,
    `${quando}`,
    `${d.location === "home" ? "Em domicílio" : "No estúdio"} · ${formatBRL(d.priceCents)}`,
  ];

  if (evento === "aguardando_sinal" && d.depositCents) {
    linhas.push(
      "",
      `Sinal de ${formatBRL(d.depositCents)} a combinar. O horário fica guardado até ${DateTime.fromJSDate(
        d.holdExpiresAt ?? d.startsAt,
      )
        .setZone("America/Sao_Paulo")
        .toFormat("dd/LL 'às' HH:mm")}.`,
    );
  }
  if (evento === "aguardando_tamanho") {
    linhas.push(
      "",
      `Tamanho escolhido pela cliente: ${d.variante ?? "—"}.`,
      "Ela mandou uma foto. Confira no painel e aprove ou ajuste o tamanho — o valor acompanha.",
    );
  }
  if (evento === "expirado") {
    linhas.push(
      "",
      "O horário voltou para a agenda. Se quiser, você ainda consegue reativar e confirmar pelo painel.",
    );
  }

  linhas.push("", `${baseUrl()}/admin/clientes/${d.customerId}`);
  return linhas.join("\n");
}

export interface DadosMi {
  customerId: string;
  clienteNome: string;
  clienteTelefone: string;
  servico: string;
  startsAt: Date;
  location: string;
  priceCents: number;
  depositCents?: number | null;
  holdExpiresAt?: Date | null;
  /** A3 — nome do tamanho escolhido, quando houver. */
  variante?: string | null;
}

/**
 * Carrega o booking e avisa a Mi. Best-effort de ponta a ponta: qualquer erro
 * (banco, Evolution, template) é engolido e logado — o chamador nunca sente.
 */
export async function notificarMi(
  evento: EventoMi,
  bookingId: string,
): Promise<void> {
  try {
    const b = await prisma.booking.findUnique({
      where: { id: bookingId },
      select: {
        customerId: true,
        startsAt: true,
        location: true,
        priceCents: true,
        depositCents: true,
        holdExpiresAt: true,
        customer: { select: { name: true, phoneE164: true } },
        service: { select: { name: true } },
        variant: { select: { nome: true } },
        items: {
          orderBy: { sort: "asc" },
          select: { service: { select: { name: true } } },
        },
      },
    });
    if (!b) return;

    // Multi-serviço: lista os nomes ("A + B"); fallback no serviço primário.
    const servico =
      b.items.length > 0
        ? b.items.map((i) => i.service.name).join(" + ")
        : b.service.name;

    const texto = montarMensagemMi(evento, {
      customerId: b.customerId,
      clienteNome: b.customer.name,
      clienteTelefone: b.customer.phoneE164,
      servico,
      startsAt: b.startsAt,
      location: b.location,
      priceCents: b.priceCents,
      depositCents: b.depositCents,
      holdExpiresAt: b.holdExpiresAt,
      variante: b.variant?.nome ?? null,
    });

    await sendTransactional({
      telefone: numeroDaMi(),
      texto,
      dedupeKey: `mi:${evento}:${bookingId}`,
      templateKey: `mi_${evento}`,
      // Sem clienteId: a mensagem é PARA a Mi. Amarrá-la à cliente sujaria o
      // histórico de conversa dela no painel.
      clienteId: null,
    });
  } catch (e) {
    console.error("notificarMi: falha em", evento, bookingId, e);
  }
}
