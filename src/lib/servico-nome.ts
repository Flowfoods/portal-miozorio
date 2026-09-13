/**
 * A6 — identidade de nome de serviço.
 *
 * Para a Mi, "Buço", "buço " e "BUÇO" são o mesmo serviço. O cadastro não
 * comparava nome nenhum (só o `code` era unificado com sufixo -2, -3), então
 * cada clique repetido no botão virava um registro novo — foi assim que
 * "Buço · 10min" acabou três vezes no banco de produção.
 *
 * Vive fora de `actions.ts` porque aquele arquivo é `"use server"` e só pode
 * exportar funções async. Aqui também fica testável sem banco.
 */
export function chaveServico(nome: string): string {
  return nome
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** Dois nomes são o mesmo serviço aos olhos da Mi? */
export function mesmoServico(a: string, b: string): boolean {
  return chaveServico(a) === chaveServico(b);
}
