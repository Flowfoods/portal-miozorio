/**
 * Consentimento específico para dado de saúde na anamnese (R6/R18).
 *
 * A alergia é dado de saúde e, pela LGPD, dado **sensível** (art. 5º, II). O
 * tratamento por consentimento exige que ele seja "específico e destacado, para
 * finalidades específicas" (art. 11, I) — o aceite genérico da política de
 * privacidade não cobre, porque não é específico nem destacado.
 *
 * O desenho aqui evita o erro comum de pedir consentimento sensível para todo
 * mundo: **só é exigido quando a pessoa de fato escreve alguma alergia.** Campo
 * em branco não coleta dado de saúde nenhum, então não há o que consentir — e a
 * cliente que não tem alergia não vê caixinha extra alguma.
 *
 * Módulo PURO: sem Prisma, sem I/O. A regra é testável sozinha, e o
 * `booking-service` só a chama.
 */

/**
 * Chaves da anamnese que carregam dado de saúde. Hoje só `alergia`; se um campo
 * novo de saúde entrar na anamnese (medicação, gravidez, condição de pele), ele
 * entra AQUI e passa a exigir o mesmo consentimento, sem tocar em mais nada.
 */
export const CAMPOS_DE_SAUDE = ["alergia"] as const;

/** A anamnese enviada contém, de fato, algum dado de saúde preenchido? */
export function coletaDadoDeSaude(
  anamnesis: Record<string, unknown> | null | undefined,
): boolean {
  if (!anamnesis) return false;
  return CAMPOS_DE_SAUDE.some(
    (campo) => String(anamnesis[campo] ?? "").trim().length > 0,
  );
}

/**
 * A reserva deve ser recusada por falta de consentimento específico?
 * Verdadeiro só quando há dado de saúde preenchido E o consentimento não veio.
 */
export function faltaConsentimentoSaude(
  anamnesis: Record<string, unknown> | null | undefined,
  consentiu: boolean | undefined,
): boolean {
  return coletaDadoDeSaude(anamnesis) && consentiu !== true;
}

/**
 * Momento a gravar em `booking.health_consent_at`. `null` quando não há dado de
 * saúde: nunca carimbamos consentimento que não foi pedido — auditoria de LGPD
 * com data inventada é pior do que auditoria vazia.
 */
export function carimboConsentimentoSaude(
  anamnesis: Record<string, unknown> | null | undefined,
  consentiu: boolean | undefined,
  agora: Date = new Date(),
): Date | null {
  return coletaDadoDeSaude(anamnesis) && consentiu === true ? agora : null;
}

/** Mensagem para a cliente. Explica o porquê, sem jargão jurídico (R13). */
export const MSG_FALTA_CONSENTIMENTO_SAUDE =
  "Para guardar o que você contou sobre alergia, preciso da sua autorização — é uma informação de saúde e ela tem cuidado extra. Marque a caixinha ou deixe o campo em branco 💛";
