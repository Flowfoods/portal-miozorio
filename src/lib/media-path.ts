import path from "node:path";

/**
 * Decide se um caminho pedido em `/media/...` pode sair pela rota PÚBLICA.
 *
 * Função pura (recebe os diretórios, não lê env nem toca em disco) porque esta
 * é a única fronteira entre a foto de portfólio e a foto de referência da
 * cliente — e uma fronteira de LGPD merece teste, não confiança.
 *
 * Recusa três coisas:
 *  1. path traversal para fora do volume;
 *  2. qualquer extensão que não seja `.webp` (só servimos o que geramos);
 *  3. o store PRIVADO, que mora num subdiretório do público — as duas travas
 *     anteriores o aprovavam, e ele sairia com cache imutável de um ano.
 */
export function podeServirPublicamente(opts: {
  mediaDir: string;
  privateDir: string;
  segments: string[];
}): boolean {
  const file = path.normalize(path.join(opts.mediaDir, ...opts.segments));
  const raizPublica = path.normalize(opts.mediaDir) + path.sep;
  const raizPrivada = path.normalize(opts.privateDir);

  if (!file.startsWith(raizPublica)) return false;
  if (!file.endsWith(".webp")) return false;
  if (file === raizPrivada || file.startsWith(raizPrivada + path.sep)) {
    return false;
  }
  return true;
}
