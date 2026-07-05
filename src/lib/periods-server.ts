import { cookies } from "next/headers";
import {
  parsePeriodo,
  type ParsePeriodoOpts,
  type ParsePeriodoResult,
} from "./periods";

/**
 * Leitura do período no SERVIDOR (páginas/rotas do admin) — o único ponto de
 * parse. Precedência: URL (fonte de verdade, compartilhável) → cookie do
 * módulo (último preset escolhido) → fallback do módulo. Nunca lança.
 */
export function periodoDaRequest(
  modulo: string,
  searchParams: { periodo?: string; de?: string; ate?: string },
  opts: ParsePeriodoOpts = {},
): ParsePeriodoResult {
  const temUrl = searchParams.periodo || searchParams.de || searchParams.ate;
  if (temUrl) return parsePeriodo(searchParams, opts);

  const cookie = cookies().get(`mi_periodo_${modulo}`)?.value;
  if (cookie) {
    const sp = Object.fromEntries(new URLSearchParams(cookie));
    return parsePeriodo(sp, opts);
  }
  return parsePeriodo({}, opts);
}
