import Link from "next/link";
import { notFound } from "next/navigation";
import { DateTime } from "luxon";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";
import { formatBRL, formatPhoneBR, waLink } from "@/lib/format";
import { EVENTO_LABEL } from "@/lib/crm-listas";
import { REGUA_LABEL } from "@/lib/reguas";
import { lerAnamnese } from "@/lib/anamnesis";
import SubmitButton from "@/components/admin/SubmitButton";
import { STATUS_LABEL, STATUS_STYLE } from "@/components/admin/bookingStatus";
import { contarIndicacoesFechadas } from "@/lib/clube";
import {
  adminUpdateCustomer,
  adminUpdateCustomerCare,
  adminUpdateCustomerCrm,
  adminSetPhotoConsent,
  adminResetStrikes,
  adminEnrollCustomer,
  adminAddRedemption,
  adminRedeemReward,
  adminAdjustPoints,
} from "../../actions";
import { getSaldoExtrato } from "@/lib/clube-pontos";

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://miozorio.com.br";

export const dynamic = "force-dynamic";

/**
 * Ficha da cliente (M11): contato com atalho de WhatsApp, alergia persistente
 * (separada da anamnese de cada atendimento), anotações privadas da Mi,
 * autorização de foto (LGPD — R18) e histórico completo de atendimentos.
 */
export default async function FichaClientePage({
  params,
}: {
  params: { id: string };
}) {
  const [settings, customer] = await Promise.all([
    getSettings(),
    prisma.customer
      .findUnique({
        where: { id: params.id },
        include: {
          bookings: {
            include: { service: true },
            orderBy: { startsAt: "desc" },
            take: 60,
          },
          milestones: { orderBy: { nivel: "asc" } },
          redemptions: { orderBy: { resgatadoEm: "desc" }, take: 10 },
          referredBy: { select: { id: true, name: true } },
          _count: { select: { referrals: true } },
        },
      })
      .catch(() => null), // id fora do formato uuid → 404, não erro 500
  ]);
  if (!customer) notFound();

  const indicacoesFechadas = customer.clubJoinedAt
    ? await contarIndicacoesFechadas(customer.id)
    : 0;

  // Clube por pontos: saldo + extrato + recompensas disponíveis.
  const [clube, recompensas] = customer.clubJoinedAt
    ? await Promise.all([
        getSaldoExtrato(customer.id),
        prisma.clubReward.findMany({
          where: { ativo: true },
          orderBy: [{ sort: "asc" }, { custoPontos: "asc" }],
        }),
      ])
    : [{ saldo: 0, extrato: [] as Awaited<ReturnType<typeof getSaldoExtrato>>["extrato"] }, []];

  // Atividade no site (F1/F3): resumo + últimos eventos, em linguagem leiga.
  const [enviosRecentes, eventos, resumoAtividade] = await Promise.all([
    prisma.envioMensagem.findMany({
      where: { customerId: customer.id },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { id: true, kind: true, status: true, createdAt: true },
    }),
    prisma.clientEvent.findMany({
      where: { clientId: customer.id },
      orderBy: { createdAt: "desc" },
      take: 8,
      select: { id: true, tipo: true, createdAt: true },
    }),
    prisma.$queryRawUnsafe<
      { visitas30: number; tentativas30: number; ultimoAcesso: Date | null }[]
    >(
      `SELECT
         COUNT(*) FILTER (WHERE tipo = 'SESSAO_INICIADA'
           AND created_at >= now() - INTERVAL '30 days')::int AS "visitas30",
         COUNT(*) FILTER (WHERE tipo IN ('INICIOU_AGENDAMENTO','ABANDONOU_AGENDAMENTO')
           AND created_at >= now() - INTERVAL '30 days')::int AS "tentativas30",
         MAX(created_at) FILTER (WHERE tipo IN ('SESSAO_INICIADA','LOGIN_CLUBE')) AS "ultimoAcesso"
       FROM client_events WHERE client_id = $1`,
      customer.id,
    ),
  ]);
  const atividade = resumoAtividade[0] ?? {
    visitas30: 0,
    tentativas30: 0,
    ultimoAcesso: null,
  };

  const tz = settings.timezone;
  const now = DateTime.now().setZone(tz);

  const concluidos = customer.bookings.filter(
    (b) => b.status === "completed",
  ).length;
  const faltas = customer.bookings.filter((b) => b.status === "no_show").length;

  const birth = customer.birthDate
    ? DateTime.fromJSDate(customer.birthDate, { zone: "utc" })
    : null;
  const idade = birth ? Math.floor(now.diff(birth, "years").years) : null;
  const menor = idade != null && idade < 18;

  return (
    <>
      <Link
        href="/admin/clientes"
        className="text-sm text-mi-marrom-escuro underline underline-offset-4"
      >
        ← Clientes
      </Link>

      <div className="mb-6 mt-2 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl">{customer.name}</h1>
          <p className="text-sm text-mi-texto/80">
            {formatPhoneBR(customer.phoneE164)}
            {idade != null && <> · {idade} anos{menor ? " (menor — responsável obrigatório)" : ""}</>}
            {" · "}cliente desde{" "}
            {DateTime.fromJSDate(customer.createdAt)
              .setZone(tz)
              .toFormat("LL/yyyy")}
          </p>
        </div>
        <a
          href={waLink(customer.phoneE164)}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-mi bg-mi-marrom-escuro px-4 py-2.5 text-sm text-white"
        >
          Chamar no WhatsApp
        </a>
      </div>

      {customer.allergies && (
        <div className="mb-6 rounded-mi bg-red-50 p-4 text-sm text-red-900 ring-1 ring-red-200">
          <p className="font-medium">⚠ Alergia registrada na ficha</p>
          <p className="mt-1 whitespace-pre-line">{customer.allergies}</p>
        </div>
      )}

      <div className="mb-8 grid gap-4 lg:grid-cols-2">
        {/* Dados de contato */}
        <section className="rounded-mi bg-mi-branco p-5 shadow-suave">
          <h2 className="mb-4 text-xl">Dados da cliente</h2>
          <form action={adminUpdateCustomer} className="space-y-3 text-sm">
            <input type="hidden" name="id" value={customer.id} />
            <label className="block">
              <span className="mb-1 block text-xs text-mi-texto/80">Nome</span>
              <input
                name="name"
                defaultValue={customer.name}
                required
                className="input-mi w-full"
              />
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-xs text-mi-texto/80">
                  WhatsApp
                </span>
                <input
                  name="phone"
                  defaultValue={formatPhoneBR(customer.phoneE164)}
                  required
                  className="input-mi w-full"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs text-mi-texto/80">
                  Nascimento (opcional)
                </span>
                <input
                  type="date"
                  name="birthDate"
                  defaultValue={birth?.toISODate() ?? ""}
                  className="input-mi w-full"
                />
              </label>
            </div>
            <label className="block">
              <span className="mb-1 block text-xs text-mi-texto/80">
                E-mail (opcional)
              </span>
              <input
                type="email"
                name="email"
                defaultValue={customer.email ?? ""}
                className="input-mi w-full"
              />
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-xs text-mi-texto/80">
                  Responsável (se menor)
                </span>
                <input
                  name="guardianName"
                  defaultValue={customer.guardianName ?? ""}
                  className="input-mi w-full"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs text-mi-texto/80">
                  Telefone do responsável
                </span>
                <input
                  name="guardianPhone"
                  defaultValue={
                    customer.guardianPhone
                      ? formatPhoneBR(customer.guardianPhone)
                      : ""
                  }
                  className="input-mi w-full"
                />
              </label>
            </div>
            <SubmitButton
              pendingLabel="Salvando…"
              className="rounded-mi bg-mi-marrom-escuro px-4 py-2 text-sm text-white"
            >
              Salvar dados
            </SubmitButton>
          </form>
        </section>

        {/* Cuidados: alergia persistente + anotações privadas */}
        <section className="rounded-mi bg-mi-branco p-5 shadow-suave">
          <h2 className="mb-4 text-xl">Cuidados e anotações</h2>
          <form action={adminUpdateCustomerCare} className="space-y-3 text-sm">
            <input type="hidden" name="id" value={customer.id} />
            <label className="block">
              <span className="mb-1 block text-xs text-mi-texto/80">
                Alergias da cliente (aparece destacado em todo atendimento)
              </span>
              <textarea
                name="allergies"
                rows={2}
                defaultValue={customer.allergies ?? ""}
                placeholder="Ex.: alergia a látex; evitar produtos com fragrância"
                className="input-mi w-full"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs text-mi-texto/80">
                Anotações da Mi (só você vê)
              </span>
              <textarea
                name="notes"
                rows={4}
                defaultValue={customer.notes ?? ""}
                placeholder="Preferências, tom de pele, o que funcionou da última vez…"
                className="input-mi w-full"
              />
            </label>
            <SubmitButton
              pendingLabel="Salvando…"
              className="rounded-mi bg-mi-marrom-escuro px-4 py-2 text-sm text-white"
            >
              Salvar anotações
            </SubmitButton>
          </form>
        </section>

        {/* Autorização de foto (R18) */}
        <section className="rounded-mi bg-mi-branco p-5 shadow-suave">
          <h2 className="mb-2 text-xl">Foto do resultado</h2>
          <p className="mb-3 text-sm text-mi-texto/80">
            Só publique foto da cliente (site ou Instagram) com a autorização
            registrada aqui.
          </p>
          {customer.photoConsent ? (
            <p className="mb-3 text-sm text-emerald-900">
              ✓ Autorizou o uso de fotos
              {customer.photoConsentAt && (
                <>
                  {" "}em{" "}
                  {DateTime.fromJSDate(customer.photoConsentAt)
                    .setZone(tz)
                    .toFormat("dd/LL/yyyy 'às' HH:mm")}
                </>
              )}
            </p>
          ) : (
            <p className="mb-3 text-sm text-mi-texto/80">
              Sem autorização registrada.
            </p>
          )}
          <form
            action={adminSetPhotoConsent.bind(
              null,
              customer.id,
              !customer.photoConsent,
            )}
          >
            <button
              className={`rounded-mi px-4 py-2 text-sm ${
                customer.photoConsent
                  ? "border border-mi-cinza text-red-800"
                  : "bg-mi-marrom-escuro text-white"
              }`}
            >
              {customer.photoConsent
                ? "Remover autorização"
                : "Registrar autorização"}
            </button>
          </form>
        </section>

        {/* Cancelamentos / sinal */}
        <section className="rounded-mi bg-mi-branco p-5 shadow-suave">
          <h2 className="mb-2 text-xl">Cancelamentos</h2>
          <p className="text-sm text-mi-texto/80">
            {customer.strikes} cancelamento(s) em cima da hora · {faltas}{" "}
            falta(s) · {concluidos} atendimento(s) concluído(s)
          </p>
          {customer.requiresDeposit && (
            <p className="mt-2 text-sm text-red-800">
              ⚠ Só reagenda mediante pagamento de sinal.
            </p>
          )}
          {(customer.strikes > 0 || customer.requiresDeposit) && (
            <form
              action={adminResetStrikes.bind(null, customer.id)}
              className="mt-3"
            >
              <button className="rounded-mi border border-mi-cinza px-4 py-2 text-sm">
                Perdoar (zerar e liberar)
              </button>
            </form>
          )}
        </section>

        {/* CRM — segmentação RFV + funil + opt-in */}
        <section className="rounded-mi bg-mi-branco p-5 shadow-suave lg:col-span-2">
          <h2 className="mb-3 text-xl">Relacionamento</h2>
          <div className="mb-4 flex flex-wrap gap-2 text-sm">
            {customer.rfvSegmento ? (
              <>
                <span className="rounded-full bg-mi-bege px-3 py-1 font-medium text-mi-marrom-escuro">
                  {customer.rfvSegmento}
                </span>
                <span className="rounded-full bg-mi-bege/50 px-3 py-1 text-mi-texto/80">
                  R {customer.rScore} · F {customer.fScore} · V {customer.vScore}
                </span>
                <span className="rounded-full bg-mi-bege/50 px-3 py-1 text-mi-texto/80">
                  LTV previsto {formatBRL(customer.ltvPrevistoCents ?? 0)}
                </span>
              </>
            ) : (
              <span className="text-mi-texto/80">
                Segmentação ainda não calculada (roda todo dia automaticamente).
              </span>
            )}
          </div>
          <form action={adminUpdateCustomerCrm} className="space-y-3 text-sm">
            <input type="hidden" name="id" value={customer.id} />
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-xs text-mi-texto/80">
                  Etiquetas (separadas por vírgula)
                </span>
                <input
                  name="tags"
                  defaultValue={customer.tags.join(", ")}
                  placeholder="vip, indica muito, pele sensível"
                  className="input-mi w-full"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs text-mi-texto/80">
                  Origem (como chegou)
                </span>
                <input
                  name="origem"
                  defaultValue={customer.origem ?? ""}
                  placeholder="instagram, indicação, anúncio…"
                  className="input-mi w-full"
                />
              </label>
            </div>
            <label className="block">
              <span className="mb-1 block text-xs text-mi-texto/80">
                Etapa do funil de noiva/debutante
              </span>
              <select
                name="funilEtapa"
                defaultValue={customer.funilEtapa ?? ""}
                className="input-mi w-full"
              >
                <option value="">— não está no funil</option>
                <option value="lead">Primeiro contato</option>
                <option value="previa_agendada">Prévia agendada</option>
                <option value="previa_feita">Prévia feita</option>
                <option value="contrato_fechado">Contrato fechado</option>
                <option value="evento">Evento</option>
                <option value="pos_evento">Pós-evento</option>
              </select>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                name="whatsappOptIn"
                defaultChecked={customer.whatsappOptIn}
                className="h-4 w-4 accent-mi-marrom"
              />
              <span>
                Autoriza mensagens de relacionamento no WhatsApp (jornadas)
                {customer.whatsappOptInAt && (
                  <span className="text-mi-texto/80">
                    {" "}· desde{" "}
                    {DateTime.fromJSDate(customer.whatsappOptInAt)
                      .setZone(tz)
                      .toFormat("dd/LL/yyyy")}
                  </span>
                )}
              </span>
            </label>
            <SubmitButton
              pendingLabel="Salvando…"
              className="rounded-mi bg-mi-marrom-escuro px-4 py-2 text-sm text-white"
            >
              Salvar CRM
            </SubmitButton>
          </form>
        </section>

        {/* Clube de Fidelidade */}
        <section className="rounded-mi bg-mi-branco p-5 shadow-suave lg:col-span-2">
          <h2 className="mb-2 text-xl">Clube</h2>
          {customer.referredBy && (
            <p className="mb-2 text-sm text-mi-texto/80">
              Indicada por{" "}
              <Link
                href={`/admin/clientes/${customer.referredBy.id}`}
                className="underline underline-offset-4"
              >
                {customer.referredBy.name}
              </Link>
              {customer.clubInterest && <> · {customer.clubInterest}</>}
            </p>
          )}
          {customer.clubJoinedAt ? (
            <div className="space-y-3 text-sm">
              <p className="text-mi-texto/80">
                Membro desde{" "}
                {DateTime.fromJSDate(customer.clubJoinedAt)
                  .setZone(tz)
                  .toFormat("dd/LL/yyyy")}{" "}
                · {indicacoesFechadas} indicação(ões) realizadas
                {customer._count.referrals > indicacoesFechadas && (
                  <>
                    {" "}
                    · {customer._count.referrals - indicacoesFechadas} aguardando
                    atendimento
                  </>
                )}
              </p>
              <p className="break-all rounded-mi bg-mi-bege/60 px-3 py-2 text-xs text-mi-texto/80">
                Link de indicação: {SITE}/indicar/{customer.referralCode}
              </p>

              {/* Pontos (Anexo 1) */}
              <div className="rounded-mi bg-mi-bege/40 p-3">
                <p className="font-medium text-mi-marrom-escuro">
                  Saldo: {clube.saldo} pontos
                </p>
                {recompensas.length > 0 && (
                  <form
                    action={adminRedeemReward}
                    className="mt-2 flex flex-wrap items-end gap-2"
                  >
                    <input type="hidden" name="customerId" value={customer.id} />
                    <select
                      name="rewardId"
                      className="input-mi !w-auto flex-1 !py-2"
                    >
                      {recompensas.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.nome} — {r.custoPontos} pts
                        </option>
                      ))}
                    </select>
                    <SubmitButton
                      pendingLabel="Resgatando…"
                      className="rounded-mi border border-mi-cinza px-4 py-2 text-sm"
                    >
                      Resgatar
                    </SubmitButton>
                  </form>
                )}
                <form
                  action={adminAdjustPoints}
                  className="mt-2 flex flex-wrap items-end gap-2"
                >
                  <input type="hidden" name="customerId" value={customer.id} />
                  <input
                    name="pontos"
                    type="number"
                    placeholder="±pts"
                    className="input-mi w-20 !py-2"
                  />
                  <input
                    name="descricao"
                    placeholder="motivo do ajuste"
                    className="input-mi !w-auto flex-1 !py-2"
                  />
                  <SubmitButton
                    pendingLabel="Salvando…"
                    className="rounded-mi border border-mi-cinza px-4 py-2 text-sm"
                  >
                    Ajustar
                  </SubmitButton>
                </form>
                {clube.extrato.length > 0 && (
                  <ul className="mt-2 space-y-0.5 text-xs text-mi-texto/80">
                    {clube.extrato.slice(0, 8).map((t) => (
                      <li key={t.id}>
                        {t.pontos > 0 ? "+" : ""}
                        {t.pontos} · {t.descricao} ·{" "}
                        {DateTime.fromJSDate(t.createdAt)
                          .setZone(tz)
                          .toFormat("dd/LL/yy")}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              {customer.milestones.length > 0 && (
                <ul className="space-y-1 text-xs text-mi-texto/80">
                  {customer.milestones.map((m) => (
                    <li key={m.id}>
                      {m.nivel}ª indicação · {m.beneficio} ·{" "}
                      {m.resgatadoEm ? (
                        <span className="text-emerald-900">entregue</span>
                      ) : (
                        <span className="text-amber-900">a entregar</span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              {customer.redemptions.length > 0 && (
                <div className="text-xs text-mi-texto/80">
                  Brindes avulsos:{" "}
                  {customer.redemptions
                    .map(
                      (r) =>
                        `${r.beneficio} (${DateTime.fromJSDate(r.resgatadoEm)
                          .setZone(tz)
                          .toFormat("dd/LL/yy")})`,
                    )
                    .join(" · ")}
                </div>
              )}
              <form
                action={adminAddRedemption}
                className="flex flex-wrap items-center gap-2"
              >
                <input type="hidden" name="customerId" value={customer.id} />
                <input
                  name="beneficio"
                  placeholder="Registrar brinde entregue (ex.: mimo de aniversário)"
                  className="input-mi !w-auto flex-1 !py-2"
                />
                <SubmitButton
                  pendingLabel="Salvando…"
                  className="rounded-mi border border-mi-cinza px-4 py-2 text-sm"
                >
                  Registrar
                </SubmitButton>
              </form>
            </div>
          ) : (
            <form action={adminEnrollCustomer.bind(null, customer.id)}>
              <p className="mb-3 text-sm text-mi-texto/80">
                Ainda não participa. Incluir gera o código e o link de indicação
                dela.
              </p>
              <button className="rounded-mi bg-mi-marrom-escuro px-4 py-2 text-sm text-white">
                Incluir no clube
              </button>
            </form>
          )}
        </section>
      </div>

      {/* Atividade no site (F3 — comportamento first-party) */}
      <section className="mb-8 rounded-mi bg-mi-branco p-5 shadow-suave">
        <h2 className="mb-2 text-xl">Atividade no site</h2>
        <p className="mb-4 text-sm text-mi-texto/80">
          O que ela fez no portal — visitas, tentativas de agendamento e
          compartilhamentos.
        </p>
        <div className="mb-4 grid grid-cols-3 gap-3 text-center">
          <div className="rounded-mi bg-mi-bege/60 p-3">
            <p className="font-titulo text-2xl text-mi-marrom-escuro">
              {atividade.visitas30}
            </p>
            <p className="text-xs text-mi-texto/80">visitas (30 dias)</p>
          </div>
          <div className="rounded-mi bg-mi-bege/60 p-3">
            <p className="font-titulo text-2xl text-mi-marrom-escuro">
              {atividade.tentativas30}
            </p>
            <p className="text-xs text-mi-texto/80">tentativas de agendar</p>
          </div>
          <div className="rounded-mi bg-mi-bege/60 p-3">
            <p className="font-titulo text-2xl text-mi-marrom-escuro">
              {atividade.ultimoAcesso
                ? DateTime.fromJSDate(atividade.ultimoAcesso)
                    .setZone(tz)
                    .toFormat("dd/LL")
                : "—"}
            </p>
            <p className="text-xs text-mi-texto/80">último acesso</p>
          </div>
        </div>
        {enviosRecentes.length > 0 && (
          <div className="mb-4">
            <p className="mb-1 text-xs font-medium text-mi-texto/80">
              Mensagens (F4)
            </p>
            <ul className="space-y-1 text-sm">
              {enviosRecentes.map((e) => (
                <li key={e.id} className="flex justify-between gap-3">
                  <span>
                    {REGUA_LABEL[e.kind] ?? e.kind}
                    <span className="ml-1.5 text-xs text-mi-texto/80">
                      ({e.status === "aguardando" ? "na fila" : e.status})
                    </span>
                  </span>
                  <span className="shrink-0 text-mi-texto/80">
                    {DateTime.fromJSDate(e.createdAt).setZone(tz).toFormat("dd/LL")}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {eventos.length === 0 ? (
          <p className="text-sm text-mi-texto/80">
            Nenhuma atividade registrada ainda (o rastreio começou em jul/2026).
          </p>
        ) : (
          <ul className="space-y-1 text-sm">
            {eventos.map((e) => (
              <li key={String(e.id)} className="flex justify-between gap-3">
                <span>{EVENTO_LABEL[e.tipo] ?? e.tipo}</span>
                <span className="shrink-0 text-mi-texto/80">
                  {DateTime.fromJSDate(e.createdAt)
                    .setZone(tz)
                    .toFormat("dd/LL HH:mm")}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Histórico */}
      <section>
        <h2 className="mb-3 text-xl">Histórico de atendimentos</h2>
        {customer.bookings.length === 0 && (
          <p className="rounded-mi bg-mi-branco p-6 text-sm text-mi-texto/80 shadow-suave">
            Nenhum atendimento ainda.
          </p>
        )}
        <div className="space-y-2">
          {customer.bookings.map((b) => {
            const starts = DateTime.fromJSDate(b.startsAt).setZone(tz);
            const iso = starts.toISODate();
            const alergiaAnamnese = lerAnamnese(b.anamnesis).alergia;
            return (
              <Link
                key={b.id}
                href={`/admin?data=${iso}#b-${b.id}`}
                className="flex flex-wrap items-center justify-between gap-2 rounded-mi bg-mi-branco p-4 text-sm shadow-suave transition-colors hover:bg-mi-cinza/40"
              >
                <span>
                  <span className="font-medium">
                    {starts.toFormat("dd/LL/yyyy HH:mm")}
                  </span>{" "}
                  · {b.service.name} ·{" "}
                  {b.location === "home" ? "domicílio" : "estúdio"} ·{" "}
                  {formatBRL(b.priceCents)}
                  {alergiaAnamnese && (
                    <span className="block text-xs text-red-800">
                      ⚠ Alergia informada nesse atendimento: {alergiaAnamnese}
                    </span>
                  )}
                </span>
                <span
                  className={`rounded-full px-3 py-1 text-xs ${STATUS_STYLE[b.status]}`}
                >
                  {STATUS_LABEL[b.status]}
                </span>
              </Link>
            );
          })}
        </div>
      </section>
    </>
  );
}
