import { z } from "zod";

export const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
export const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export const availabilityQuery = z.object({
  serviceId: z.string().regex(UUID_RE),
  date: z.string().regex(DATE_RE),
  location: z.enum(["studio", "home"]).optional(),
  // Multi-serviço (encaixe admin): soma das durações dos itens. Ausente → usa a
  // duração do próprio serviço. Cap defensivo de 12h.
  durationMin: z.coerce.number().int().min(1).max(720).optional(),
});

/**
 * Teto do base64 da foto (~4MB de imagem). O navegador reduz para 1600px JPEG
 * antes de enviar, então uma foto real fica muito abaixo disto; o teto existe
 * para o POST forjado.
 */
const FOTO_BASE64_MAX = 5_600_000;

export const createBookingBody = z.object({
  serviceId: z.string().regex(UUID_RE),
  date: z.string().regex(DATE_RE),
  time: z.string().regex(TIME_RE),
  location: z.enum(["studio", "home"]).default("studio"),
  customer: z.object({
    name: z.string().min(2),
    phone: z.string().min(8),
    email: z.string().regex(EMAIL_RE).optional(),
    birthDate: z.string().regex(DATE_RE).optional(),
    guardianName: z.string().optional(),
    guardianPhone: z.string().optional(),
  }),
  anamnesis: z.record(z.string(), z.unknown()).optional(),
  lgpdConsent: z.boolean(),
  // Origem do agendamento público. "area_cliente" = veio da retenção da Área
  // da Cliente (habilita o bônus de reagendamento na conclusão — F5).
  source: z.enum(["web", "area_cliente"]).default("web"),
  // A3 — tamanho escolhido e foto para a Mi conferir.
  variantId: z.string().regex(UUID_RE).optional(),
  // A foto vem NO corpo do agendamento, em base64, e não por um endpoint de
  // upload público: assim ela herda as proteções que já existem aqui (honeypot,
  // teto de reservas em aberto por telefone) em vez de abrir uma porta nova de
  // escrita anônima. O navegador já reduz antes de enviar.
  fotoBase64: z.string().max(FOTO_BASE64_MAX).optional(),
  // Honeypot: campo invisível no formulário. Humano nunca preenche — mesmo
  // padrão já usado em joinClub. Preenchido = bot.
  site: z.string().optional(),
});
