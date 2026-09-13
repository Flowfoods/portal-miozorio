/**
 * A3 — variação por tamanho. Funções PURAS (testáveis sem banco).
 *
 * Regra de ouro da retrocompatibilidade: serviço SEM variações passa por aqui
 * e sai exatamente como entrou. Nada de flag "tem variação" governando o
 * comportamento — quem governa é a existência das linhas.
 */

export interface VarianteBase {
  id: string;
  nome: string;
  priceCents: number;
  priceHomeCents: number | null;
  /** Null = herda a duração do serviço. */
  durationMin: number | null;
  active: boolean;
}

export interface ServicoBase {
  priceCents: number;
  priceHomeCents: number | null;
  durationMin: number;
}

/** Preço efetivo: a variação manda; sem variação, o serviço. */
export function precoEfetivo(
  servico: ServicoBase,
  variante: VarianteBase | null,
  location: "studio" | "home",
): number {
  if (variante) {
    return location === "home" && variante.priceHomeCents != null
      ? variante.priceHomeCents
      : variante.priceCents;
  }
  return location === "home" && servico.priceHomeCents != null
    ? servico.priceHomeCents
    : servico.priceCents;
}

/**
 * Duração efetiva. A variação só sobrepõe se declarar a própria — "cabelo
 * longo" pode custar mais e demorar o mesmo, e o contrário também vale.
 */
export function duracaoEfetiva(
  servico: ServicoBase,
  variante: VarianteBase | null,
): number {
  return variante?.durationMin ?? servico.durationMin;
}

/** Variações que a cliente pode escolher, na ordem em que a Mi cadastrou. */
export function variantesVisiveis<T extends { active: boolean; sort?: number }>(
  todas: T[],
): T[] {
  return todas
    .filter((v) => v.active)
    .sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0));
}

/** O serviço exige que a cliente escolha um tamanho? */
export function exigeTamanho(variantes: { active: boolean }[]): boolean {
  return variantes.some((v) => v.active);
}

export interface EstadoTamanho {
  variantId: string | null;
  sizeApprovedAt: Date | null;
}

/**
 * O agendamento está esperando a Mi conferir a foto e validar o tamanho?
 *
 * Deliberadamente derivado, não armazenado como status: um BookingStatus novo
 * cairia fora do `WHERE status IN ('pending','confirmed')` da constraint
 * no_overlap e o horário deixaria de ser protegido contra double-booking (R2).
 */
export function aguardandoValidacaoTamanho(b: EstadoTamanho): boolean {
  return b.variantId != null && b.sizeApprovedAt == null;
}

/** Rótulo para a tela, sem jargão (R13). */
export function rotuloTamanho(b: EstadoTamanho): string | null {
  if (b.variantId == null) return null;
  return b.sizeApprovedAt == null
    ? "Aguardando você conferir o tamanho"
    : "Tamanho conferido";
}
