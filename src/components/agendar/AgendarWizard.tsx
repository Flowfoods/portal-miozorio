"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Image from "next/image";
import {
  formatBRL,
  formatDuration,
  maskPhoneBR,
  formatDateLong,
} from "@/lib/format";
import Tabs from "@/components/ui/Tabs";
import Chip from "@/components/ui/Chip";
import WeekStrip, { type DiaStrip } from "@/components/ui/WeekStrip";
import Botao from "@/components/ui/Botao";
import BarraResumo from "./BarraResumo";
import { trackClient } from "@/lib/track-client";
import { otimizar } from "@/lib/imagem-client";

interface ApiService {
  id: string;
  code: string;
  name: string;
  category: string;
  durationMin: number;
  priceCents: number;
  priceHomeCents: number | null;
  pendingPrice: boolean;
  isCourse: boolean;
  /** Dias próprios (Luxon 1=seg..7=dom); null = regra padrão. M9.5. */
  availableWeekdays: number[] | null;
  /** A2 — foto de exemplo do serviço; null = monograma. */
  foto: { url: string; alt: string; blurData: string | null } | null;
  /** A3 — tamanhos. Lista vazia = serviço normal, fluxo idêntico ao de sempre. */
  variantes: {
    id: string;
    nome: string;
    priceCents: number;
    priceHomeCents: number | null;
    durationMin: number | null;
  }[];
}

type Location = "studio" | "home";

const OCCASIONS = [
  "Casamento (madrinha/convidada)",
  "Formatura",
  "Aniversário",
  "Ensaio fotográfico",
  "Debutante",
  "Outro",
];

const STEPS = ["Serviço", "Data", "Horário", "Seus dados", "Confirmação"];

/* Rótulos humanos por categoria do banco — apresentação, não regra (R13). */
const CATEGORIA_LABELS: Record<string, string> = {
  social: "Maquiagem",
  cabelo: "Penteado & cabelo",
  sobrancelha: "Sobrancelha",
  curso: "Curso",
};
const CATEGORIA_ORDEM = ["social", "cabelo", "sobrancelha", "curso"];

export default function AgendarWizard() {
  const [step, setStep] = useState(1);

  const [services, setServices] = useState<ApiService[] | null>(null);
  const [loadError, setLoadError] = useState(false);

  const [service, setService] = useState<ApiService | null>(null);
  const [location, setLocation] = useState<Location>("studio");
  const [categoria, setCategoria] = useState("todos");

  const [date, setDate] = useState<string | null>(null);
  const [slots, setSlots] = useState<string[] | null>(null);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [slotsErro, setSlotsErro] = useState(false);
  const [time, setTime] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    allergy: "",
    /** Autorização específica para o dado de saúde (R6/R18). Só vale se
     *  `allergy` estiver preenchido — ver a caixinha condicional no passo 3. */
    healthConsent: false,
    reference: "",
    occasion: "",
    lgpd: false,
    // Honeypot: invisível para a cliente, irresistível para robô.
    site: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [booking, setBooking] = useState<{
    id: string;
    holdExpiresAt: string;
  } | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  // A3 — tamanho escolhido e foto do cabelo. Só entram em cena quando o
  // serviço tem variação; serviço normal nem vê estes campos.
  const [varianteId, setVarianteId] = useState<string | null>(null);
  const [fotoFile, setFotoFile] = useState<File | null>(null);
  const [fotoPreview, setFotoPreview] = useState<string>("");
  // A7 — reserva feita, sinal a combinar com a Mi. Não é erro: o horário já
  // está guardado. `null` = não se aplica.
  const [aguardandoSinal, setAguardandoSinal] = useState<{
    prazo: string;
    depositCents: number | null;
  } | null>(null);

  const search = useSearchParams();
  const preselectCode = search.get("servico");
  // Veio da retenção da Área da Cliente ("Hora de se cuidar de novo" / repetir):
  // marca a origem p/ o bônus de reagendamento na conclusão (F5).
  const daAreaCliente = search.get("origem") === "cuidar";
  const preselectDone = useRef(false);

  // Tracking F1 (funil de agendamento). Refs para o handler de saída da página.
  const iniciouRef = useRef(false);
  const concluiuRef = useRef(false);

  // VISUALIZOU ao entrar; ABANDONOU ao sair se começou e não concluiu.
  useEffect(() => {
    trackClient("VISUALIZOU_AGENDAMENTO");
    const onLeave = () => {
      if (iniciouRef.current && !concluiuRef.current) {
        trackClient("ABANDONOU_AGENDAMENTO");
      }
    };
    window.addEventListener("pagehide", onLeave);
    return () => window.removeEventListener("pagehide", onLeave);
  }, []);

  // INICIOU na 1ª escolha de serviço (cobre seleção manual e pré-seleção).
  useEffect(() => {
    if (service && !iniciouRef.current) {
      iniciouRef.current = true;
      trackClient("INICIOU_AGENDAMENTO", { servico: service.code });
    }
  }, [service]);

  // Marca concluído (o servidor já registra AGENDAMENTO_CONCLUIDO de forma
  // autoritativa; aqui só evita o falso "abandono" ao sair após concluir).
  useEffect(() => {
    if (confirmed) concluiuRef.current = true;
  }, [confirmed]);

  useEffect(() => {
    fetch("/api/services")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error())))
      .then((d: { services: ApiService[] }) => setServices(d.services))
      .catch(() => setLoadError(true));
  }, []);

  // M9 — pré-seleção via /agendar?servico=<code> (vindo do catálogo Dia a Dia).
  // Aplica uma única vez, quando os serviços chegam.
  useEffect(() => {
    if (preselectDone.current || !services || !preselectCode) return;
    const found = services.find((s) => s.code === preselectCode);
    if (found) {
      setService(found);
      setStep(2);
    }
    preselectDone.current = true;
  }, [services, preselectCode]);

  const priceForLocation = (s: ApiService): number | null => {
    // A3 — com tamanho escolhido, o preço é o da variação.
    const v = s.variantes.find((x) => x.id === varianteId);
    if (v) return location === "home" ? v.priceHomeCents : v.priceCents;
    return location === "home" ? s.priceHomeCents : s.priceCents;
  };

  // Tabs de categoria derivadas dos serviços do banco (R3).
  const categorias = useMemo(() => {
    if (!services) return [];
    const presentes = Array.from(new Set(services.map((s) => s.category)));
    presentes.sort((a, b) => {
      const ia = CATEGORIA_ORDEM.indexOf(a);
      const ib = CATEGORIA_ORDEM.indexOf(b);
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
    });
    return [
      { id: "todos", label: "Todos" },
      ...presentes.map((c) => ({
        id: c,
        label: CATEGORIA_LABELS[c] ?? c.charAt(0).toUpperCase() + c.slice(1),
      })),
    ];
  }, [services]);

  const servicosFiltrados = useMemo(
    () =>
      categoria === "todos"
        ? services
        : (services?.filter((s) => s.category === categoria) ?? null),
    [services, categoria],
  );

  const validDates = useMemo(() => {
    if (!service) return [];
    const out: string[] = [];
    const now = new Date();
    const lead = new Date(now.getTime() + 24 * 3600 * 1000);
    for (let i = 0; i <= 90; i++) {
      const d = new Date(now);
      d.setDate(now.getDate() + i);
      d.setHours(12, 0, 0, 0);
      if (d < lead) continue;
      const dow = d.getDay(); // 0=dom ... 6=sáb
      const luxonWd = dow === 0 ? 7 : dow; // 1=seg..7=dom
      // M9.5: serviço com dias próprios respeita-os; senão, curso=qualquer dia,
      // demais=fim de semana (agenda social).
      const ok =
        service.availableWeekdays && service.availableWeekdays.length
          ? service.availableWeekdays.includes(luxonWd)
          : service.isCourse
            ? true
            : dow === 0 || dow === 6;
      if (ok) out.push(d.toISOString().slice(0, 10));
    }
    return out;
  }, [service]);

  // Datas agrupadas por mês para o week-strip (guia visual §2.2).
  const gruposMes = useMemo(() => {
    const grupos: { mes: string; dias: DiaStrip[] }[] = [];
    for (const iso of validDates.slice(0, 24)) {
      const d = new Date(`${iso}T12:00:00`);
      const mes = d.toLocaleDateString("pt-BR", {
        month: "long",
        year: "numeric",
      });
      const dia: DiaStrip = {
        id: iso,
        diaSemana: d
          .toLocaleDateString("pt-BR", { weekday: "short" })
          .replace(".", "")
          .toUpperCase(),
        diaMes: String(d.getDate()).padStart(2, "0"),
      };
      const ultimo = grupos[grupos.length - 1];
      if (ultimo && ultimo.mes === mes) ultimo.dias.push(dia);
      else grupos.push({ mes, dias: [dia] });
    }
    return grupos;
  }, [validDates]);

  useEffect(() => {
    if (!service || !date) return;
    setSlotsLoading(true);
    setSlots(null);
    setTime(null);
    fetch(
      `/api/availability?serviceId=${service.id}&date=${date}&location=${location}`,
    )
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error())))
      .then((d: { slots: string[] }) => {
        setSlots(d.slots);
        setSlotsErro(false);
      })
      // Falha de rede virava lista vazia, indistinguível de dia lotado — e a
      // cliente lia "esse dia já está cheio" num dia inteiramente livre.
      .catch(() => {
        setSlots([]);
        setSlotsErro(true);
      })
      .finally(() => setSlotsLoading(false));
  }, [service, date, location]);

  // A3 — com variação, tamanho e foto são obrigatórios: é a foto que permite a
  // Mi conferir antes de fechar o valor. Serviço sem variação não muda nada.
  const precisaTamanho = (service?.variantes.length ?? 0) > 0;
  const tamanhoOk = !precisaTamanho || (varianteId !== null && fotoFile !== null);

  /** Escreveu alergia? Então a autorização específica é obrigatória (R6/R18). */
  const consentimentoSaudeOk =
    form.allergy.trim().length === 0 || form.healthConsent;

  const canSubmit =
    form.name.trim().length >= 2 &&
    form.phone.replace(/\D/g, "").length >= 10 &&
    form.occasion.length > 0 &&
    form.lgpd &&
    consentimentoSaudeOk &&
    tamanhoOk;

  /** O que ainda falta, na voz da Mi — dito no clique, não escondido. */
  const faltaPreencher =
    precisaTamanho && varianteId === null
      ? "Escolhe o tamanho do seu cabelo? 💛"
      : precisaTamanho && fotoFile === null
        ? "Falta a foto do cabelo pra eu conferir o tamanho 💛"
        : form.name.trim().length < 2
          ? "Me conta seu nome? 💛"
          : form.phone.replace(/\D/g, "").length < 10
            ? "Confere o WhatsApp? Use DDD + número."
            : form.occasion.length === 0
              ? "Escolhe a ocasião pra eu me preparar direitinho 💛"
              : !consentimentoSaudeOk
                ? "Falta autorizar o cuidado com a informação de alergia — ou deixe o campo em branco 💛"
                : "Falta aceitar a política de privacidade.";

  async function submitBooking() {
    if (!service || !date || !time) return;
    setSubmitting(true);
    setFormError(null);
    try {
      // A3 — reduz no navegador antes de enviar (mesma função que o painel
      // usa) e manda em base64 no corpo do agendamento. Sem endpoint de upload
      // público: a foto herda as proteções que já existem nesta rota.
      let fotoBase64: string | undefined;
      if (fotoFile) {
        const otimizada = await otimizar(fotoFile);
        fotoBase64 = await new Promise<string>((res, rej) => {
          const fr = new FileReader();
          fr.onload = () => res(String(fr.result));
          fr.onerror = () => rej(new Error("leitura"));
          fr.readAsDataURL(otimizada);
        });
      }
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serviceId: service.id,
          date,
          time,
          location,
          customer: {
            name: form.name.trim(),
            phone: form.phone,
            email: form.email.trim() || undefined,
          },
          anamnesis: {
            alergia: form.allergy.trim(),
            referencia: form.reference.trim(),
            ocasiao: form.occasion,
          },
          lgpdConsent: form.lgpd,
          healthConsent: form.healthConsent,
          site: form.site,
          ...(varianteId ? { variantId: varianteId } : {}),
          ...(fotoBase64 ? { fotoBase64 } : {}),
          ...(daAreaCliente ? { source: "area_cliente" } : {}),
        }),
      });
      if (res.status === 409) {
        setFormError("Esse horário acabou de ser reservado Escolha outro?");
        setTime(null);
        setSlots(null);
        setStep(3);
        // re-dispara o fetch de slots
        const d = date;
        setDate(null);
        setTimeout(() => setDate(d), 0);
        return;
      }
      if (!res.ok) {
        // Nunca ecoar a mensagem crua do servidor: "Dados inválidos" e "JSON
        // inválido" são texto de sistema e chegavam à cliente no último passo,
        // sem dizer qual campo. 422 já vem com mensagem escrita para ela.
        const e = (await res.json().catch(() => ({}))) as { error?: string };
        setFormError(
          res.status === 422 && e.error
            ? e.error
            : res.status === 400
              ? "Confere os campos? Algum dado ficou fora do formato — o e-mail é o mais comum."
              : "Não consegui criar seu agendamento. Tenta de novo?",
        );
        return;
      }
      const data = (await res.json()) as {
        id: string;
        holdExpiresAt: string;
        aguardandoSinal?: boolean;
        depositCents?: number | null;
      };
      setBooking(data);
      // A7: com sinal a reserva já está guardada e quem fecha é a Mi pelo
      // WhatsApp. Chamar /confirm aqui só rendia 402 — a cliente lia a recusa
      // como "não agendou" e ia atrás da Mi no Instagram.
      if (data.aguardandoSinal) {
        setAguardandoSinal({
          prazo: data.holdExpiresAt,
          depositCents: data.depositCents ?? null,
        });
        return;
      }
      setStep(5);
    } catch {
      setFormError("Tivemos um probleminha de conexão. Tenta de novo, tá?");
    } finally {
      setSubmitting(false);
    }
  }

  async function confirmBooking() {
    if (!booking) return;
    setSubmitting(true);
    setFormError(null);
    try {
      const res = await fetch(`/api/bookings/${booking.id}/confirm`, {
        method: "POST",
      });
      if (res.ok) {
        setConfirmed(true);
        return;
      }
      const e = (await res.json().catch(() => ({}))) as {
        error?: string;
        code?: string;
      };
      setFormError(e.error ?? "Não consegui confirmar.");
    } catch {
      setFormError("Tivemos um probleminha de conexão. Tenta de novo?");
    } finally {
      setSubmitting(false);
    }
  }

  if (confirmed && service && date && time) {
    return <SuccessScreen service={service} date={date} time={time} />;
  }

  if (aguardandoSinal && service && date && time) {
    return (
      <AguardandoSinalScreen
        bookingId={booking?.id ?? ""}
        service={service}
        date={date}
        time={time}
        prazo={aguardandoSinal.prazo}
        depositCents={aguardandoSinal.depositCents}
        onPago={() => setConfirmed(true)}
      />
    );
  }

  const mostraBarra = step >= 2 && step <= 4 && service !== null;

  return (
    <div
      className={`mx-auto w-full max-w-lg px-5 py-8 ${mostraBarra ? "pb-28" : ""}`}
    >
      <Stepper step={step} />

      {/* STEP 1 — Serviço */}
      {step === 1 && (
        <section className="mt-8">
          <h2 className="font-titulo text-3xl text-mi-marrom-escuro">
            Qual atendimento você quer?
          </h2>

          <div className="mt-5 inline-flex rounded-mi bg-mi-cinza p-1">
            {(["studio", "home"] as Location[]).map((loc) => (
              <button
                key={loc}
                onClick={() => setLocation(loc)}
                className={`min-h-[44px] rounded-[10px] px-5 font-corpo text-sm transition-colors ${
                  location === loc
                    ? "bg-mi-branco text-mi-marrom-escuro shadow-suave"
                    : "text-mi-marrom-700"
                }`}
              >
                {loc === "studio" ? "No estúdio" : "Em domicílio"}
              </button>
            ))}
          </div>
          {location === "home" && (
            <p className="mt-2 font-corpo text-xs text-mi-marrom-escuro">
              O atendimento em domicílio inclui a taxa de deslocamento
            </p>
          )}

          {loadError && (
            <p className="mt-8 font-corpo text-mi-texto">
              Poxa, não consegui carregar os serviços agora. Recarrega a página?
            </p>
          )}
          {!services && !loadError && <CardsSkeleton />}

          {categorias.length > 2 && (
            <div className="mt-6">
              <Tabs
                items={categorias}
                ativo={categoria}
                onSelect={setCategoria}
                ariaLabel="Categorias de atendimento"
              />
            </div>
          )}

          <div className="mt-6 space-y-3">
            {servicosFiltrados?.map((s) => {
              const price = priceForLocation(s);
              const unavailableHome =
                location === "home" && s.priceHomeCents === null;
              return (
                <button
                  key={s.id}
                  disabled={unavailableHome}
                  onClick={() => {
                    setService(s);
                    setDate(null);
                    setSlots(null);
                    // A3 — tamanho e foto são do serviço anterior; trocar de
                    // serviço sem limpar mandaria uma variação de outro
                    // catálogo, que o backend recusa.
                    setVarianteId(null);
                    setFotoFile(null);
                    setFotoPreview("");
                    setStep(2);
                  }}
                  className="flex w-full items-center gap-4 rounded-mi border border-mi-cinza bg-mi-branco p-3 text-left shadow-suave transition-colors hover:border-mi-marrom disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {/* A2 — a foto que a Mi subiu no painel. Sem foto, o
                      monograma: nunca um retângulo vazio nem "sem imagem". */}
                  <span className="relative block h-20 w-16 shrink-0 overflow-hidden rounded-[10px] bg-mi-bege">
                    {s.foto ? (
                      <Image
                        src={s.foto.url}
                        alt={s.foto.alt}
                        fill
                        sizes="64px"
                        className="object-cover"
                        {...(s.foto.blurData
                          ? {
                              placeholder: "blur" as const,
                              blurDataURL: s.foto.blurData,
                            }
                          : {})}
                      />
                    ) : (
                      <span
                        aria-hidden
                        className="flex h-full w-full items-center justify-center font-titulo text-2xl font-medium italic text-mi-marrom-400"
                      >
                        Mi
                      </span>
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-titulo text-lg text-mi-marrom-escuro">
                      {s.name}
                    </span>
                    <span className="font-corpo text-sm text-mi-marrom-escuro">
                      {formatDuration(s.durationMin)}
                      {unavailableHome ? " · só no estúdio" : ""}
                    </span>
                  </span>
                  <span className="shrink-0 text-right font-corpo text-base font-medium text-mi-marrom-escuro">
                    {s.pendingPrice
                      ? "sob consulta"
                      : price !== null
                        ? formatBRL(price)
                        : // Domicílio sem preço próprio: o valor do estúdio
                          // SUMIA e virava "sob consulta" — a cliente perdia a
                          // única referência que tinha. Melhor mostrar o que
                          // se sabe e dizer onde vale.
                          formatBRL(s.priceCents)}
                    {unavailableHome && !s.pendingPrice && (
                      <span className="block font-corpo text-xs font-normal text-mi-texto/80">
                        no estúdio
                      </span>
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* STEP 2 — Data */}
      {step === 2 && service && (
        <section className="mt-8">
          <BackButton onClick={() => setStep(1)} />
          <h2 className="mt-3 font-titulo text-3xl text-mi-marrom-escuro">
            Escolha o dia
          </h2>
          <p className="mt-1 font-corpo text-sm text-mi-marrom-escuro">
            {service.isCourse
              ? "O curso pode ser em qualquer dia"
              : "Atendimentos aos sábados e domingos"}
          </p>

          <div className="mt-6 space-y-6">
            {gruposMes.map((grupo) => (
              <div key={grupo.mes}>
                <p className="mb-3 font-corpo text-sm capitalize text-mi-marrom-escuro">
                  {grupo.mes}
                </p>
                <WeekStrip
                  dias={grupo.dias}
                  ariaLabel={`Dias disponíveis em ${grupo.mes}`}
                  onSelect={(iso) => {
                    setDate(iso);
                    setStep(3);
                  }}
                />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* STEP 3 — Horário */}
      {step === 3 && service && date && (
        <section className="mt-8">
          <BackButton onClick={() => setStep(2)} />
          <h2 className="mt-3 font-titulo text-3xl text-mi-marrom-escuro">
            Que horas fica bom?
          </h2>
          <p className="mt-1 font-corpo text-sm capitalize text-mi-marrom-escuro">
            {formatDateLong(date)}
          </p>

          {slotsLoading && <ChipsSkeleton />}
          {!slotsLoading && slotsErro && (
            <p className="mt-6 font-corpo text-mi-texto">
              Não consegui carregar os horários agora. Toca de novo na data, por
              favor?
            </p>
          )}
          {!slotsLoading && !slotsErro && slots && slots.length === 0 && (
            <p className="mt-6 font-corpo text-mi-texto">
              Poxa, esse dia já está cheio… que tal escolher outra data?
            </p>
          )}
          <div className="mt-6 flex flex-wrap gap-2">
            {slots?.map((hhmm) => (
              <Chip
                key={hhmm}
                onClick={() => {
                  setTime(hhmm);
                  setStep(4);
                }}
              >
                {hhmm}
              </Chip>
            ))}
          </div>
        </section>
      )}

      {/* STEP 4 — Seus dados + anamnese */}
      {step === 4 && service && (
        <section className="mt-8">
          <BackButton onClick={() => setStep(3)} />
          <h2 className="mt-3 font-titulo text-3xl text-mi-marrom-escuro">
            Seus dados
          </h2>

          {/* A3 — tamanho + foto. Só aparece se o serviço tiver variação; um
              serviço normal nem sabe que isto existe. */}
          {service.variantes.length > 0 && (
            <div className="mt-6 rounded-mi border border-mi-cinza bg-mi-branco p-4">
              <p className="font-titulo text-xl text-mi-marrom-escuro">
                Qual o tamanho do seu cabelo?
              </p>
              <p className="mt-1 font-corpo text-sm text-mi-texto">
                Escolha o que mais parece com o seu e mande uma foto — assim eu
                reservo o tempo certinho e confirmo o valor antes do dia 💛
              </p>

              <div className="mt-3 flex flex-wrap gap-2">
                {service.variantes.map((v) => (
                  <Chip
                    key={v.id}
                    ativo={varianteId === v.id}
                    onClick={() => setVarianteId(v.id)}
                  >
                    {v.nome} ·{" "}
                    {formatBRL(
                      location === "home" && v.priceHomeCents != null
                        ? v.priceHomeCents
                        : v.priceCents,
                    )}
                  </Chip>
                ))}
              </div>

              <label className="mt-4 block font-corpo text-sm text-mi-marrom-escuro">
                Foto do seu cabelo
                <input
                  type="file"
                  accept="image/*"
                  className="mt-1 block w-full font-corpo text-sm text-mi-texto file:mr-3 file:min-h-[44px] file:rounded-mi file:border file:border-mi-cinza file:bg-mi-bege file:px-4 file:font-corpo file:text-sm file:text-mi-marrom-escuro"
                  onChange={(e) => {
                    const f = e.target.files?.[0] ?? null;
                    setFotoFile(f);
                    setFotoPreview(f ? URL.createObjectURL(f) : "");
                  }}
                />
              </label>
              {fotoPreview && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={fotoPreview}
                  alt="Foto que você escolheu"
                  className="mt-2 h-28 w-24 rounded-mi object-cover"
                />
              )}
              <p className="mt-2 font-corpo text-xs text-mi-texto/80">
                A foto fica guardada em privado, só a Mi vê.
              </p>
            </div>
          )}

          <div className="mt-6 space-y-4">
            <Field label="Seu nome">
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="input-mi"
                autoComplete="name"
                placeholder="Como você gosta de ser chamada"
              />
            </Field>
            <Field label="WhatsApp">
              <input
                value={form.phone}
                type="tel"
                inputMode="numeric"
                autoComplete="tel"
                onChange={(e) =>
                  setForm({ ...form, phone: maskPhoneBR(e.target.value) })
                }
                className="input-mi"
                placeholder="(21) 90000-0000"
              />
            </Field>
            <Field label="E-mail (opcional)">
              {/* type="email" + inputMode: o campo é opcional, mas o servidor
                  valida o formato — sem isto, um "ana@" derrubava o
                  agendamento no último passo, sem dizer qual campo. */}
              <input
                value={form.email}
                type="email"
                inputMode="email"
                autoComplete="email"
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="input-mi"
                placeholder="seu@email.com"
              />
            </Field>

            <Field label="Tem alguma alergia?" highlight>
              <textarea
                value={form.allergy}
                onChange={(e) => setForm({ ...form, allergy: e.target.value })}
                className="input-mi min-h-[64px]"
                placeholder="Conte aqui qualquer sensibilidade da sua pele"
              />
              {/* R6/R18 — alergia é dado de saúde, e a LGPD pede consentimento
                  específico e destacado (art. 11, I): o aceite genérico da
                  política não cobre. A caixinha só aparece para quem escreveu
                  alguma coisa — quem não tem alergia não leva pergunta extra.
                  <!-- APROVAR COM A MI: texto da autorização --> */}
              {form.allergy.trim().length > 0 && (
                <label className="mt-3 flex items-start gap-3 rounded-mi bg-mi-marrom-50 p-3 font-corpo text-sm text-mi-texto">
                  <input
                    type="checkbox"
                    checked={form.healthConsent}
                    onChange={(e) =>
                      setForm({ ...form, healthConsent: e.target.checked })
                    }
                    className="mt-0.5 h-5 w-5 shrink-0 accent-mi-marrom"
                  />
                  <span>
                    Autorizo a Mi a guardar essa informação de saúde para cuidar
                    da minha pele com segurança. Fica só com ela, e você pode
                    pedir para apagar quando quiser.
                  </span>
                </label>
              )}
            </Field>
            <Field label="Já tem referência do que quer?">
              <textarea
                value={form.reference}
                onChange={(e) =>
                  setForm({ ...form, reference: e.target.value })
                }
                className="input-mi min-h-[64px]"
                placeholder="Descreva ou conte que vai levar fotos de inspiração"
              />
            </Field>
            <Field label="Qual a ocasião?">
              <select
                value={form.occasion}
                onChange={(e) => setForm({ ...form, occasion: e.target.value })}
                className="input-mi"
              >
                <option value="">Selecione…</option>
                {OCCASIONS.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            </Field>

            {/* Honeypot — fora da tela e do leitor de tela; só robô preenche. */}
            <input
              type="text"
              name="site"
              tabIndex={-1}
              autoComplete="off"
              aria-hidden="true"
              value={form.site}
              onChange={(e) => setForm({ ...form, site: e.target.value })}
              className="absolute left-[-9999px] h-0 w-0 opacity-0"
            />

            <label className="flex items-start gap-3 font-corpo text-sm text-mi-texto">
              <input
                type="checkbox"
                checked={form.lgpd}
                onChange={(e) => setForm({ ...form, lgpd: e.target.checked })}
                className="mt-1 h-5 w-5 shrink-0 accent-mi-marrom"
              />
              <span>
                Li e aceito a{" "}
                <a href="/privacidade" className="underline" target="_blank">
                  política de privacidade
                </a>
                . Seus dados são tratados com cuidado e sigilo
              </span>
            </label>

            {formError && (
              <p className="font-corpo text-sm text-mi-erro-tinta">{formError}</p>
            )}

            {/* Botão fica HABILITADO: apagado a 40% e mudo, a cliente não
                descobria o que faltava — o único rótulo marcado na tela é
                "E-mail (opcional)", então ela concluía que o resto também era. */}
            <button
              disabled={submitting}
              onClick={() => {
                if (!canSubmit) {
                  setFormError(faltaPreencher);
                  return;
                }
                setFormError(null);
                void submitBooking();
              }}
              className="min-h-[52px] w-full rounded-mi bg-mi-marrom-escuro font-corpo text-base text-mi-branco shadow-suave transition-colors hover:bg-mi-marrom disabled:cursor-not-allowed disabled:opacity-40"
            >
              {submitting ? "Reservando…" : "Continuar"}
            </button>
          </div>
        </section>
      )}

      {/* STEP 5 — Confirmação */}
      {step === 5 && service && date && time && booking && (
        <section className="mt-8">
          <h2 className="font-titulo text-3xl text-mi-marrom-escuro">
            Quase lá!
          </h2>
          <p className="mt-1 font-corpo text-sm text-mi-marrom-escuro">
            Confirme os detalhes do seu horário
          </p>

          <dl className="mt-6 space-y-3 rounded-mi border border-mi-cinza bg-mi-branco p-5 shadow-suave">
            <Row label="Atendimento" value={service.name} />
            <Row
              label="Local"
              value={location === "home" ? "Em domicílio" : "No estúdio"}
            />
            <Row label="Dia" value={formatDateLong(date)} />
            <Row label="Horário" value={time} />
            <Row label="Nome" value={form.name} />
          </dl>

          <HoldCountdown
            holdExpiresAt={booking.holdExpiresAt}
            onExpire={() => {
              setFormError(
                "O tempo da reserva expirou. Vamos escolher de novo?",
              );
              setBooking(null);
              setConfirmed(false);
              setStep(3);
            }}
          />

          {formError && (
            <p className="mt-3 font-corpo text-sm text-mi-erro-tinta">{formError}</p>
          )}

          <button
            disabled={submitting}
            onClick={confirmBooking}
            className="mt-6 min-h-[52px] w-full rounded-mi bg-mi-marrom-escuro font-corpo text-base text-mi-branco shadow-suave transition-colors hover:bg-mi-marrom disabled:opacity-40"
          >
            {submitting ? "Confirmando…" : "Confirmar meu horário"}
          </button>
        </section>
      )}

      {mostraBarra && service && (
        <BarraResumo
          servico={service.name}
          preco={
            service.pendingPrice || priceForLocation(service) === null
              ? "valor sob consulta"
              : formatBRL(priceForLocation(service) as number)
          }
          detalhe={
            date
              ? `${formatDateLong(date)}${time ? ` · ${time}` : ""}`
              : undefined
          }
        />
      )}
    </div>
  );
}

function Stepper({ step }: { step: number }) {
  return (
    <ol className="flex items-center gap-1.5">
      {STEPS.map((label, i) => {
        const n = i + 1;
        const done = n <= step;
        return (
          <li key={label} className="flex flex-1 flex-col items-center gap-1.5">
            <span
              className={`h-1.5 w-full rounded-full ${
                done ? "bg-mi-marrom" : "bg-mi-cinza"
              }`}
            />
            <span
              className={`font-corpo text-xs ${
                done ? "text-mi-marrom-escuro" : "text-mi-marrom-escuro"
              }`}
            >
              {label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="font-corpo text-sm text-mi-marrom-escuro">{label}</dt>
      <dd className="text-right font-corpo text-mi-texto">{value}</dd>
    </div>
  );
}

function Field({
  label,
  highlight,
  children,
}: {
  label: string;
  highlight?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span
        className={`mb-1.5 block font-corpo text-sm ${
          highlight ? "font-medium text-mi-marrom-escuro" : "text-mi-marrom-700"
        }`}
      >
        {label}
      </span>
      {children}
    </label>
  );
}

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      // Era 40×20px sem padding — e é justamente o substituto do Voltar do
      // Android neste wizard, que não reflete o passo na URL.
      className="-ml-2 inline-flex min-h-[44px] items-center px-2 font-corpo text-sm text-mi-marrom-escuro transition-colors hover:text-mi-marrom-700"
    >
      ‹ voltar
    </button>
  );
}

function CardsSkeleton() {
  return (
    <div className="mt-6 space-y-3">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="h-[72px] animate-pulse rounded-mi border border-mi-cinza bg-mi-cinza/40"
        />
      ))}
    </div>
  );
}

function ChipsSkeleton() {
  return (
    <div className="mt-6 flex flex-wrap gap-2">
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <div
          key={i}
          className="h-[48px] w-20 animate-pulse rounded-mi bg-mi-cinza/40"
        />
      ))}
    </div>
  );
}

function HoldCountdown({
  holdExpiresAt,
  onExpire,
}: {
  holdExpiresAt: string;
  onExpire: () => void;
}) {
  const [left, setLeft] = useState(() =>
    Math.max(
      0,
      Math.floor((new Date(holdExpiresAt).getTime() - Date.now()) / 1000),
    ),
  );
  useEffect(() => {
    const t = setInterval(() => {
      const s = Math.max(
        0,
        Math.floor((new Date(holdExpiresAt).getTime() - Date.now()) / 1000),
      );
      setLeft(s);
      if (s <= 0) {
        clearInterval(t);
        onExpire();
      }
    }, 1000);
    return () => clearInterval(t);
  }, [holdExpiresAt, onExpire]);

  const mm = Math.floor(left / 60);
  const ss = (left % 60).toString().padStart(2, "0");
  return (
    <p className="mt-4 text-center font-corpo text-sm text-mi-marrom-escuro">
      Reservamos esse horário pra você por mais{" "}
      <span className="font-medium text-mi-marrom-escuro">
        {mm}:{ss}
      </span>
    </p>
  );
}

/**
 * A7 — reserva feita, sinal a combinar. O portal não tem gateway: o PIX do
 * sinal vai direto para a Mi, então esta tela entrega o horário guardado, o
 * prazo real e o caminho do WhatsApp. Antes disto a cliente via a recusa 402
 * como erro de formulário e ia embora achando que não tinha agendado.
 */
function AguardandoSinalScreen({
  bookingId,
  service,
  date,
  time,
  prazo,
  depositCents,
  onPago,
}: {
  bookingId: string;
  service: ApiService;
  date: string;
  time: string;
  prazo: string;
  depositCents: number | null;
  onPago: () => void;
}) {
  // A7 (conclusão) — o PIX. Só aparece se o portal tiver gateway configurado;
  // a rota devolve 501 quando não tem, e a tela segue no caminho do WhatsApp,
  // que é como a Mi trabalha hoje. Nenhum botão que não leva a lugar nenhum.
  const [pix, setPix] = useState<{
    copiaECola: string;
    qrCodeBase64: string | null;
  } | null>(null);
  const [gerando, setGerando] = useState(false);
  const [semGateway, setSemGateway] = useState(false);
  const [erroPix, setErroPix] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);

  async function gerarPix() {
    setGerando(true);
    setErroPix(null);
    try {
      const res = await fetch(`/api/bookings/${bookingId}/sinal`, {
        method: "POST",
      });
      if (res.status === 501) {
        setSemGateway(true);
        return;
      }
      const d = (await res.json().catch(() => ({}))) as {
        copiaECola?: string;
        qrCodeBase64?: string | null;
        error?: string;
      };
      if (!res.ok || !d.copiaECola) {
        setErroPix(d.error ?? "Não consegui gerar o PIX agora.");
        return;
      }
      setPix({ copiaECola: d.copiaECola, qrCodeBase64: d.qrCodeBase64 ?? null });
    } catch {
      setErroPix("Tivemos um probleminha de conexão. Tenta de novo?");
    } finally {
      setGerando(false);
    }
  }

  // Enquanto o PIX está na tela, pergunta ao portal se já caiu. O webhook é o
  // caminho normal; este poll é o que faz a tela REAGIR sem a cliente ter que
  // recarregar depois de pagar.
  useEffect(() => {
    if (!pix || !bookingId) return;
    const t = setInterval(async () => {
      try {
        const r = await fetch(`/api/bookings/${bookingId}/sinal`);
        if (!r.ok) return;
        const d = (await r.json()) as { pago?: boolean; confirmado?: boolean };
        if (d.pago || d.confirmado) {
          clearInterval(t);
          onPago();
        }
      } catch {
        // Rede instável não pode virar erro na cara da cliente: o webhook e o
        // cron de conciliação fecham o caso de qualquer jeito.
      }
    }, 4000);
    return () => clearInterval(t);
  }, [pix, bookingId, onPago]);

  const prazoFmt = new Date(prazo).toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
  const wa = `https://wa.me/5521970225231?text=${encodeURIComponent(
    `Oi Mi! Reservei ${service.name} para ${formatDateLong(date)} às ${time} e quero combinar o sinal 💛`,
  )}`;
  return (
    <div className="mx-auto flex min-h-[70dvh] max-w-lg flex-col items-center justify-center px-6 py-12 text-center">
      <p className="font-corpo text-xs uppercase tracking-[0.3em] text-mi-marrom-escuro">
        Reserva feita
      </p>
      <h1 className="mt-5 font-titulo text-4xl text-mi-marrom-escuro">
        Seu horário está guardado 💛
      </h1>
      <p className="mt-4 font-corpo text-mi-texto">
        <strong>{service.name}</strong> ·{" "}
        <span className="capitalize">{formatDateLong(date)}</span> às{" "}
        <strong>{time}</strong>.
      </p>
      <div className="mt-6 w-full rounded-mi border border-mi-cinza bg-mi-branco p-5 text-left shadow-suave">
        <p className="font-corpo text-sm text-mi-texto">
          Para fechar, falta combinar o sinal
          {depositCents != null && depositCents > 0 ? (
            <>
              {" "}
              de <strong>{formatBRL(depositCents)}</strong>
            </>
          ) : null}
          {semGateway
            ? ". A Mi te chama no WhatsApp para acertar — e você também pode chamar ela agora, se preferir."
            : ". Você pode pagar por PIX aqui mesmo, ou combinar com a Mi no WhatsApp."}
        </p>
        <p className="mt-3 font-corpo text-sm text-mi-marrom-700">
          Guardo esse horário até <strong>{prazoFmt}</strong>. Depois disso ele
          volta para a agenda.
        </p>

        {pix && (
          <div className="mt-4 border-t border-mi-cinza pt-4">
            {pix.qrCodeBase64 && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={pix.qrCodeBase64}
                alt="QR Code do PIX do sinal"
                className="mx-auto h-48 w-48"
              />
            )}
            <p className="mt-3 font-corpo text-xs text-mi-texto/80">
              Abra o app do banco, escolha PIX e use o QR ou o código abaixo.
            </p>
            <button
              type="button"
              onClick={() => {
                void navigator.clipboard
                  ?.writeText(pix.copiaECola)
                  .then(() => setCopiado(true))
                  .catch(() => setCopiado(false));
              }}
              className="mt-2 min-h-[44px] w-full break-all rounded-mi border border-mi-cinza bg-mi-bege px-3 py-2 text-left font-mono text-xs text-mi-texto"
            >
              {pix.copiaECola}
            </button>
            <p
              role="status"
              aria-live="polite"
              className="mt-1 font-corpo text-xs text-mi-marrom-700"
            >
              {copiado
                ? "Código copiado ✓ — assim que o pagamento cair, esta tela confirma sozinha."
                : "Toque no código para copiar."}
            </p>
          </div>
        )}

        {erroPix && (
          <p role="alert" className="mt-3 font-corpo text-sm text-mi-erro-tinta">
            {erroPix} Seu horário continua guardado — fale com a Mi no WhatsApp.
          </p>
        )}
      </div>

      {!pix && !semGateway && (
        <Botao onClick={gerarPix} disabled={gerando} className="mt-6 w-full">
          {gerando ? "Gerando PIX…" : "Pagar sinal por PIX"}
        </Botao>
      )}
      <Botao
        href={wa}
        variante={pix || semGateway ? "whatsapp" : "secundario"}
        className="mt-3 w-full"
      >
        Falar com a Mi no WhatsApp
      </Botao>
      <Botao href="/" variante="secundario" className="mt-3 w-full">
        Voltar ao início
      </Botao>
    </div>
  );
}

function SuccessScreen({
  service,
  date,
  time,
}: {
  service: ApiService;
  date: string;
  time: string;
}) {
  return (
    <div className="mx-auto flex min-h-[70dvh] max-w-lg flex-col items-center justify-center px-6 py-12 text-center">
      <span
        aria-hidden
        className="mb-6 inline-flex h-16 w-16 items-center justify-center rounded-full bg-mi-ok/10 text-mi-ok"
      >
        <svg
          width="32"
          height="32"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M20 6 9 17l-5-5" />
        </svg>
      </span>
      <p className="font-corpo text-xs uppercase tracking-[0.3em] text-mi-marrom-escuro">
        Agendamento confirmado
      </p>
      <h1 className="mt-5 font-titulo text-4xl text-mi-marrom-escuro">
        Que alegria!
      </h1>
      <p className="mt-4 font-corpo text-mi-texto">
        Seu horário de <strong>{service.name}</strong> está reservado para{" "}
        <span className="capitalize">{formatDateLong(date)}</span> às{" "}
        <strong>{time}</strong>.
      </p>
      <p className="mt-3 font-corpo text-sm text-mi-marrom-escuro">
        Você vai receber a confirmação no WhatsApp Lembre de levar referências
        do que deseja!
      </p>
      <Botao href="/" className="mt-8">
        Voltar ao início
      </Botao>
    </div>
  );
}
