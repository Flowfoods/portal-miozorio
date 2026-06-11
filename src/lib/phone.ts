/**
 * Normaliza telefone brasileiro para E.164 (+55DDDNNNNNNNNN) — R5.
 * A Evolution API quebra sem isso. Retorna null se inválido.
 */
export function normalizeE164BR(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  let d = digits;

  // remove o código do país se já vier (55...)
  if (d.startsWith("55") && (d.length === 12 || d.length === 13)) {
    d = d.slice(2);
  }

  // d deve ser DDD (2) + número (8 fixo ou 9 celular) = 10 ou 11 dígitos
  if (d.length !== 10 && d.length !== 11) return null;

  const ddd = Number(d.slice(0, 2));
  if (ddd < 11 || ddd > 99) return null;

  return `+55${d}`;
}
