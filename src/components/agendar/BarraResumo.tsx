/**
 * Barra de resumo fixa do agendamento (V3) — o serviço escolhido, valor e
 * data/hora sempre visíveis enquanto a cliente navega pelos passos (R19,
 * thumb-friendly). Informativa: os passos avançam ao tocar na opção, então
 * não há botão aqui (evita CTA duplicado). Respeita safe-area do iPhone.
 */
type BarraResumoProps = {
  servico: string;
  preco: string; // já formatado ("R$ 150,00" | "valor sob consulta")
  detalhe?: string; // "sáb, 12 de julho · 15:00" quando existir
};

export default function BarraResumo({ servico, preco, detalhe }: BarraResumoProps) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-mi-cinza bg-mi-branco/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
      <div className="mx-auto flex max-w-lg items-center justify-between gap-4 px-5 py-3">
        <div className="min-w-0">
          <p className="truncate font-titulo text-lg leading-tight text-mi-marrom-escuro">
            {servico}
          </p>
          {detalhe ? (
            <p className="truncate font-corpo text-xs capitalize text-mi-marrom">
              {detalhe}
            </p>
          ) : null}
        </div>
        <p className="shrink-0 font-corpo text-base font-medium text-mi-marrom-escuro">
          {preco}
        </p>
      </div>
    </div>
  );
}
