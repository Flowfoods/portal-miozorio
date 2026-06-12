import Link from "next/link";
import { notFound } from "next/navigation";
import { DateTime } from "luxon";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";
import { formatBRL, formatPhoneBR, waLink } from "@/lib/format";
import { lerAnamnese } from "@/lib/anamnesis";
import AdminNav from "@/components/admin/AdminNav";
import SubmitButton from "@/components/admin/SubmitButton";
import { STATUS_LABEL, STATUS_STYLE } from "@/components/admin/bookingStatus";
import {
  adminUpdateCustomer,
  adminUpdateCustomerCare,
  adminSetPhotoConsent,
  adminResetStrikes,
} from "../../actions";

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
        },
      })
      .catch(() => null), // id fora do formato uuid → 404, não erro 500
  ]);
  if (!customer) notFound();

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
      <AdminNav />
      <Link
        href="/admin/clientes"
        className="text-sm text-mi-marrom underline underline-offset-4"
      >
        ← Clientes
      </Link>

      <div className="mb-6 mt-2 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl">{customer.name}</h1>
          <p className="text-sm text-mi-texto/70">
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
          className="rounded-mi bg-mi-marrom px-4 py-2.5 text-sm text-white"
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
              <span className="mb-1 block text-xs text-mi-texto/60">Nome</span>
              <input
                name="name"
                defaultValue={customer.name}
                required
                className="input-mi w-full"
              />
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-xs text-mi-texto/60">
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
                <span className="mb-1 block text-xs text-mi-texto/60">
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
              <span className="mb-1 block text-xs text-mi-texto/60">
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
                <span className="mb-1 block text-xs text-mi-texto/60">
                  Responsável (se menor)
                </span>
                <input
                  name="guardianName"
                  defaultValue={customer.guardianName ?? ""}
                  className="input-mi w-full"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs text-mi-texto/60">
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
              className="rounded-mi bg-mi-marrom px-4 py-2 text-sm text-white"
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
              <span className="mb-1 block text-xs text-mi-texto/60">
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
              <span className="mb-1 block text-xs text-mi-texto/60">
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
              className="rounded-mi bg-mi-marrom px-4 py-2 text-sm text-white"
            >
              Salvar anotações
            </SubmitButton>
          </form>
        </section>

        {/* Autorização de foto (R18) */}
        <section className="rounded-mi bg-mi-branco p-5 shadow-suave">
          <h2 className="mb-2 text-xl">Foto do resultado</h2>
          <p className="mb-3 text-sm text-mi-texto/70">
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
            <p className="mb-3 text-sm text-mi-texto/70">
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
                  : "bg-mi-marrom text-white"
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
          <p className="text-sm text-mi-texto/70">
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
      </div>

      {/* Histórico */}
      <section>
        <h2 className="mb-3 text-xl">Histórico de atendimentos</h2>
        {customer.bookings.length === 0 && (
          <p className="rounded-mi bg-mi-branco p-6 text-sm text-mi-texto/60 shadow-suave">
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
