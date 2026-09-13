/**
 * Lê os campos da anamnese (JSON do booking) de forma segura.
 *
 * `temAlergia` decide o badge de alergia da agenda (M10.2). Até a v1 ele
 * acendia sempre que o campo estivesse preenchido, sem filtrar negações — o
 * cartão dizia "⚠ Alergia registrada" com a cliente tendo respondido "Não".
 * Alerta que acende sempre é alerta que a Mi aprende a ignorar, e aí ele deixa
 * de proteger no dia em que a alergia é real.
 *
 * A11 passa a filtrar — com viés deliberado para o lado seguro. Alergia é dado
 * de saúde: falso-negativo (apagar um alerta verdadeiro) é muito pior que
 * falso-positivo. Por isso só uma lista fechada de negações puras apaga o
 * alerta. Qualquer texto que não seja exatamente uma delas acende, inclusive
 * "não uso látex, mas tenho alergia a níquel" — que um "contém não" ingênuo
 * teria silenciado.
 */
export function lerAnamnese(data: unknown): {
  alergia: string;
  referencia: string;
  ocasiao: string;
} {
  const a = (data && typeof data === "object" ? data : {}) as Record<
    string,
    unknown
  >;
  const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  return {
    alergia: str(a.alergia),
    referencia: str(a.referencia),
    ocasiao: str(a.ocasiao),
  };
}

/**
 * Respostas que significam "não tenho alergia" e nada mais. Lista FECHADA e
 * curta de propósito: cada item novo aqui é uma chance a mais de apagar um
 * alerta verdadeiro.
 */
const NEGACOES = new Set([
  "nao",
  "n",
  "nenhuma",
  "nenhum",
  "nada",
  "-",
  "--",
  "x",
  "nao tenho",
  "nao tenho alergia",
  "nao tenho nenhuma",
  "nao possuo",
  "nao sei de nenhuma",
  "sem alergia",
  "sem alergias",
  "nenhuma alergia",
  "nao ha",
  "negativo",
  "0",
]);

/** "Não!" / "  NÃO  " / "não." → "nao" (acentos, caixa, pontuação e espaços). */
function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[.!,;:]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function temAlergia(data: unknown): boolean {
  const bruto = lerAnamnese(data).alergia;
  if (!bruto) return false;
  return !NEGACOES.has(normalizar(bruto));
}
