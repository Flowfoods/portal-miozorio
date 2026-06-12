/**
 * Lê os campos da anamnese (JSON do booking) de forma segura.
 * `temAlergia` decide o badge de alergia da agenda (M10.2): por decisão do
 * Rodolfo, acende sempre que o campo estiver preenchido (literal ao master
 * prompt), sem filtrar negações.
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

export function temAlergia(data: unknown): boolean {
  return lerAnamnese(data).alergia.length > 0;
}
