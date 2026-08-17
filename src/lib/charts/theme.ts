/**
 * Tema único dos gráficos do portal (V2). SVG/CSS puro — zero dependência,
 * nada de recharts: o bundle não cresce e o SSR continua simples.
 *
 * Paleta de dados em ORDEM FIXA — todo gráfico do portal usa esta sequência.
 * Máximo 6 séries; acima disso o excedente vira "Outros" (agruparFatias).
 */
export const SERIES = [
  "#8A7361", // 1º marrom base
  "#C4AF9F", // 2º marrom claro
  "#7A8B6F", // 3º sálvia
  "#C08552", // 4º terracota
  "#A78F7B", // 5º
  "#DCCEC3", // 6º
] as const;

export const GRID = "#EDE6E0"; // linhas horizontais, 1px, sem borda externa
/** Rótulos de eixo. (O prompt pedia "mi-cinza", mas mi-cinza aqui é tom de
 *  SUPERFÍCIE #E8E6E3 — ilegível como texto. 700 garante AA em 12px.) */
export const EIXO_TEXTO = "#6B5849";
export const DESTAQUE = "#6B5849"; // barra de pico (marrom-700)
export const BARRA = "#C4AF9F"; // demais barras (marrom-300)

export const MAX_FATIAS = 6;

export type Fatia = { label: string; valor: number };

/** Ordena desc e agrupa além de MAX_FATIAS em "Outros". */
export function agruparFatias(fatias: Fatia[], max = MAX_FATIAS): Fatia[] {
  const ord = [...fatias].filter((f) => f.valor > 0).sort((a, b) => b.valor - a.valor);
  if (ord.length <= max) return ord;
  const topo = ord.slice(0, max - 1);
  const resto = ord.slice(max - 1).reduce((a, f) => a + f.valor, 0);
  return [...topo, { label: "Outros", valor: resto }];
}

export const fmtBRL = (cents: number) =>
  (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  });

export const fmtInt = (n: number) => n.toLocaleString("pt-BR");
