/**
 * A7 (conclusão) — porta de pagamento do sinal.
 *
 * A escolha entre Mercado Pago e Efí é pendência de negócio registrada no
 * `claude.md`. Em vez de travar o portal numa delas, o motor conversa com esta
 * interface e cada provedor é um adaptador. Trocar de gateway é escrever um
 * arquivo novo e mudar uma env — não mexer no fluxo de agendamento, que é o
 * caminho que gera receita.
 *
 * Regra de ouro: **sem credencial configurada, nada muda.** `gatewayAtivo()`
 * devolve null e o portal segue exatamente como hoje — reserva guardada e sinal
 * combinado no WhatsApp da Mi. Nenhuma cliente vê um botão que não funciona.
 */

export interface CobrancaPix {
  /** Id da cobrança no provedor (guardado no booking para conciliar depois). */
  id: string;
  /** Código copia-e-cola do PIX. */
  copiaECola: string;
  /** QR em data URL, quando o provedor devolve. */
  qrCodeBase64: string | null;
  /** Quando a cobrança expira no provedor. */
  expiraEm: Date | null;
}

export type StatusPagamento = "pendente" | "pago" | "expirado" | "cancelado";

export interface NovaCobranca {
  bookingId: string;
  valorCents: number;
  descricao: string;
  pagadorNome: string;
  /** E.164. Alguns provedores pedem; outros ignoram. */
  pagadorTelefone: string;
  pagadorEmail?: string | null;
  /** Minutos até a cobrança expirar no provedor. */
  expiraEmMinutos: number;
}

export interface GatewayPagamento {
  /** Nome curto, gravado no booking — conciliação precisa saber quem cobrou. */
  readonly nome: string;
  criarCobrancaPix(input: NovaCobranca): Promise<CobrancaPix>;
  consultarStatus(cobrancaId: string): Promise<StatusPagamento>;
  /**
   * Valida a autenticidade do webhook e devolve o id da cobrança, ou null se a
   * requisição não é confiável. Fail-closed: na dúvida, null.
   */
  lerWebhook(req: Request, corpo: unknown): Promise<string | null>;
}
