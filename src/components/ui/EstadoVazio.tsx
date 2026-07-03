import type { ReactNode } from "react";
import Botao from "./Botao";

/**
 * Estado vazio acolhedor (V0): borda tracejada + mensagem + CTA. Nunca deixar
 * área morta — sempre um convite para a próxima ação (guia visual §2.2).
 */
type EstadoVazioProps = {
  titulo: string;
  descricao?: string;
  cta?: { label: ReactNode; href: string };
};

export default function EstadoVazio({ titulo, descricao, cta }: EstadoVazioProps) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-mi border border-dashed border-mi-cinza bg-mi-branco/40 px-6 py-10 text-center">
      <p className="font-titulo text-xl text-mi-marrom-escuro">{titulo}</p>
      {descricao ? (
        <p className="max-w-sm font-corpo text-sm text-mi-texto">{descricao}</p>
      ) : null}
      {cta ? (
        <Botao href={cta.href} className="mt-2">
          {cta.label}
        </Botao>
      ) : null}
    </div>
  );
}
