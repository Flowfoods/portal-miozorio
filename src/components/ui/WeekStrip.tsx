/**
 * Faixa horizontal de cartões de data (V0) — padrão "minha agenda" do guia
 * visual. Dia ativo em marrom com texto branco; desabilitado esmaecido.
 * Sem hooks: exibição estática (server) ou seleção via onSelect (client).
 */
export type DiaStrip = {
  id: string;
  diaSemana: string; // "TER", "QUA"...
  diaMes: string; // "27", "28"...
  ativo?: boolean;
  desabilitado?: boolean;
};

type WeekStripProps = {
  dias: DiaStrip[];
  onSelect?: (id: string) => void;
  ariaLabel: string;
};

export default function WeekStrip({ dias, onSelect, ariaLabel }: WeekStripProps) {
  return (
    <div role="group" aria-label={ariaLabel} className="mi-carrossel">
      {dias.map((dia) => {
        const classes = `flex min-h-[76px] w-[64px] shrink-0 flex-col items-center justify-center rounded-mi border transition-colors ${
          dia.ativo
            ? "border-mi-marrom bg-mi-marrom-escuro text-mi-branco shadow-suave"
            : dia.desabilitado
              ? "border-mi-cinza bg-mi-branco/50 text-mi-texto/30"
              : "border-mi-cinza bg-mi-branco text-mi-texto hover:border-mi-marrom"
        }`;
        const conteudo = (
          <>
            <span className="font-corpo text-[10px] uppercase tracking-[0.15em]">
              {dia.diaSemana}
            </span>
            <span className="font-titulo text-2xl leading-tight">
              {dia.diaMes}
            </span>
          </>
        );
        if (!onSelect) {
          return (
            <div key={dia.id} className={classes} aria-current={dia.ativo ? "date" : undefined}>
              {conteudo}
            </div>
          );
        }
        return (
          <button
            key={dia.id}
            type="button"
            disabled={dia.desabilitado}
            aria-pressed={dia.ativo}
            onClick={() => onSelect(dia.id)}
            className={`${classes} disabled:cursor-not-allowed`}
          >
            {conteudo}
          </button>
        );
      })}
    </div>
  );
}
