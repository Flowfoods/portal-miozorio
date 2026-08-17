/**
 * Os três estados obrigatórios de todo gráfico (V2.4): carregando (skeleton
 * com o FORMATO do gráfico, nunca spinner), vazio (convite, não área morta)
 * e erro (discreto, com recarregar). Sem isso a tela quebra no primeiro mês
 * sem dado — exatamente o caso de um estúdio começando.
 */

const ALTURAS = [45, 70, 55, 90, 62, 78, 38];

export function ChartCarregando({
  formato = "barras",
  altura = 220,
}: {
  formato?: "barras" | "area" | "rosca" | "gauge" | "barras-h";
  altura?: number;
}) {
  return (
    <div
      role="status"
      aria-label="Carregando gráfico"
      className="animate-pulse"
      style={{ height: altura }}
    >
      {formato === "barras" && (
        <div className="flex h-full items-end justify-around gap-3 px-2 pb-6">
          {ALTURAS.map((h, i) => (
            <div
              key={i}
              className="w-full max-w-10 rounded-t-[6px] bg-mi-marrom-100"
              style={{ height: `${h}%` }}
            />
          ))}
        </div>
      )}
      {formato === "area" && (
        <div className="flex h-full flex-col justify-end gap-2 px-2 pb-6">
          <div className="h-2/3 rounded-mi bg-gradient-to-t from-mi-marrom-100 to-mi-marrom-50" />
        </div>
      )}
      {(formato === "rosca" || formato === "gauge") && (
        <div className="flex h-full items-center justify-center">
          <div className="h-40 w-40 rounded-full border-[24px] border-mi-marrom-100" />
        </div>
      )}
      {formato === "barras-h" && (
        <div className="flex h-full flex-col justify-center gap-3 px-2">
          {[90, 72, 58, 40, 28].map((w, i) => (
            <div key={i} className="h-6 rounded-r-[6px] bg-mi-marrom-100" style={{ width: `${w}%` }} />
          ))}
        </div>
      )}
    </div>
  );
}

export function ChartVazio({
  titulo,
  descricao,
  altura = 220,
}: {
  titulo: string;
  /** O que vai aparecer aqui quando houver dado. */
  descricao: string;
  altura?: number;
}) {
  return (
    <div
      className="flex flex-col items-center justify-center gap-2 rounded-mi border border-dashed border-mi-marrom-200 bg-mi-marrom-50/60 px-6 text-center"
      style={{ height: altura }}
    >
      <svg width="36" height="36" viewBox="0 0 36 36" fill="none" aria-hidden="true">
        <path
          d="M6 28c4-1 6-4 7-8m5 8c3-2 4-6 4-10m6 10c2-3 2-8 1-12"
          stroke="#C4AF9F"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <circle cx="27" cy="8" r="2.4" fill="#DCCEC3" />
      </svg>
      <p className="font-corpo text-rotulo font-medium text-mi-marrom-800">{titulo}</p>
      <p className="max-w-xs font-corpo text-rotulo text-mi-marrom-700">{descricao}</p>
    </div>
  );
}

export function ChartErro({
  mensagem = "Não deu para carregar este gráfico agora.",
  recarregarHref,
  altura = 220,
}: {
  mensagem?: string;
  /** URL atual — recarrega a página (server-side, sem JS extra). */
  recarregarHref?: string;
  altura?: number;
}) {
  return (
    <div
      className="flex flex-col items-center justify-center gap-2 rounded-mi bg-mi-marrom-50/60 px-6 text-center"
      style={{ height: altura }}
    >
      <p className="font-corpo text-rotulo text-mi-erro-tinta">{mensagem}</p>
      <a
        href={recarregarHref ?? ""}
        className="font-corpo text-rotulo font-medium text-mi-marrom-800 underline underline-offset-4 hover:text-mi-marrom-900"
      >
        Recarregar
      </a>
    </div>
  );
}
