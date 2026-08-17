import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { DateTime } from "luxon";
import { prisma } from "@/lib/prisma";
import { getClienteSession } from "@/lib/cliente-auth";
import ContaShell from "@/components/clube/ContaShell";
import Botao from "@/components/ui/Botao";
import EstadoVazio from "@/components/ui/EstadoVazio";
import Estrelas from "@/components/ui/Estrelas";
import { excluirMomentoAction } from "./actions";

export const metadata: Metadata = {
  title: "Meus momentos · Mi Ozorio",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const STATUS_CHIP: Record<string, { label: string; classes: string }> = {
  pendente: {
    label: "A Mi vai ler com carinho",
    classes: "bg-mi-alerta/10 text-mi-alerta-tinta",
  },
  aprovado: { label: "No ar 💛", classes: "bg-mi-sucesso/10 text-mi-sucesso-tinta" },
  rejeitado: {
    label: "Não publicado",
    classes: "bg-mi-cinza text-mi-texto/80",
  },
  arquivado: { label: "Arquivado", classes: "bg-mi-cinza text-mi-texto/80" },
};

/** Momentos da Área da Cliente (F3): os envios dela, com status e ações. */
export default async function MomentosPage({
  searchParams,
}: {
  searchParams: { enviado?: string; editado?: string };
}) {
  const s = getClienteSession();
  if (!s) redirect("/clube/entrar");
  if (s.prov) redirect("/clube/conta/senha");

  const momentos = await prisma.testimonial.findMany({
    where: { customerId: s.customerId, origem: "cliente" },
    orderBy: { createdAt: "desc" },
    include: {
      photos: { orderBy: { ordem: "asc" } },
      booking: { select: { service: { select: { name: true } } } },
    },
  });

  return (
    <ContaShell ativo="momentos">
      <h1 className="font-titulo text-3xl text-mi-marrom-escuro">
        Seus momentos
      </h1>

      {(searchParams.enviado || searchParams.editado) && (
        <p className="mt-3 rounded-mi border border-mi-ok/40 bg-mi-ok/10 p-4 font-corpo text-sm text-mi-texto">
          Recebido! A Mi vai ler com carinho 💛
        </p>
      )}

      <div className="mt-5">
        <Botao href="/clube/conta/momentos/novo" className="w-full">
          Contar um momento
        </Botao>
      </div>

      {momentos.length === 0 ? (
        <div className="mt-6">
          <EstadoVazio
            titulo="Seu primeiro momento pode estar aqui 🤎"
            descricao="Conte como foi sua experiência com a Mi — histórias reais viram inspiração pra outras clientes."
          />
        </div>
      ) : (
        <ul className="mt-6 space-y-4">
          {momentos.map((m) => {
            const chip = STATUS_CHIP[m.status] ?? STATUS_CHIP.pendente!;
            return (
              <li
                key={m.id}
                className="rounded-mi border border-mi-cinza bg-mi-branco p-5 shadow-suave"
              >
                <div className="flex items-start justify-between gap-3">
                  <span
                    className={`rounded-full px-3 py-1 font-corpo text-xs ${chip.classes}`}
                  >
                    {chip.label}
                  </span>
                  <span className="font-corpo text-xs text-mi-texto/80">
                    {DateTime.fromJSDate(m.enviadoEm ?? m.createdAt)
                      .setZone("America/Sao_Paulo")
                      .toFormat("dd/LL/yyyy")}
                  </span>
                </div>

                {m.booking?.service.name && (
                  <p className="mt-2 font-corpo text-xs text-mi-marrom-escuro">
                    {m.booking.service.name}
                  </p>
                )}
                <p className="mt-2 font-titulo text-lg italic leading-snug text-mi-texto">
                  “{m.quote}”
                </p>
                {m.rating && <Estrelas nota={m.rating} className="mt-2" />}

                {m.photos.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {m.photos.map((f) => (
                      <Image
                        key={f.id}
                        src={`/momentos/foto/${f.id}`}
                        alt="Sua foto"
                        width={72}
                        height={90}
                        unoptimized
                        className={`h-[90px] w-[72px] rounded-[10px] object-cover ${
                          f.aprovada ? "" : "opacity-40"
                        }`}
                      />
                    ))}
                  </div>
                )}

                {m.status === "rejeitado" && m.motivoRejeicao && (
                  <p className="mt-3 rounded-mi bg-mi-bege px-4 py-3 font-corpo text-sm text-mi-texto/80">
                    Recado da Mi: {m.motivoRejeicao}
                  </p>
                )}

                {m.status !== "arquivado" && (
                  <div className="mt-4 flex items-center gap-4 border-t border-mi-cinza/60 pt-3">
                    <Link
                      href={`/clube/conta/momentos/${m.id}/editar`}
                      className="font-corpo text-sm text-mi-marrom-escuro underline underline-offset-4 transition-colors hover:text-mi-marrom-escuro"
                    >
                      Editar
                    </Link>
                    <form action={excluirMomentoAction}>
                      <input type="hidden" name="id" value={m.id} />
                      <button className="font-corpo text-sm text-mi-texto/80 underline underline-offset-4 transition-colors hover:text-mi-erro-tinta">
                        Excluir
                      </button>
                    </form>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </ContaShell>
  );
}
