import { NextRequest, NextResponse } from "next/server";
import { createBookingBody } from "@/lib/validation";
import { createBooking } from "@/lib/booking-service";
import { processPrivatePhoto, deletePrivatePhoto } from "@/lib/media";
import { EV, getSid, track } from "@/lib/tracking";
import { getClienteSession } from "@/lib/cliente-auth";
import {
  maskPhone,
  metaFromHeaders,
  recordAuth,
  throttleDeReservaPorIp,
} from "@/lib/authlog";
import { opcoesCookie } from "@/lib/auth-cookies";
import {
  assinarPosse,
  nomeCookiePosse,
  validadeDaPosse,
} from "@/lib/posse-reserva";

export const dynamic = "force-dynamic";

const STATUS_BY_CODE: Record<string, number> = {
  no_consent: 422,
  invalid_service: 404,
  not_bookable: 422,
  invalid_phone: 422,
  invalid_datetime: 422,
  slot_taken: 409, // constraint no_overlap (R2)
  variante_invalida: 422,
  foto_obrigatoria: 422,
};

// POST /api/bookings  → cria pending + hold
export async function POST(req: NextRequest) {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const parsed = createBookingBody.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dados inválidos", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  // Honeypot: campo invisível preenchido = bot. Responde como se tivesse dado
  // certo (sem criar nada) para não ensinar o robô a contornar.
  if (parsed.data.site?.trim()) {
    return NextResponse.json({ id: "", holdExpiresAt: "" }, { status: 201 });
  }

  // Teto de reservas por IP. Vem ANTES da foto de propósito: processar imagem é
  // a parte cara do request, e quem está sendo barrado não deve pagar CPU nossa.
  const meta = metaFromHeaders(req.headers);
  const espera = await throttleDeReservaPorIp(meta.ip);
  if (espera.bloqueado) {
    await recordAuth("cliente", "booking_throttled", null, meta);
    return NextResponse.json(
      {
        error: `Muitos horários marcados desta conexão agora há pouco. Tente de novo em ${espera.minutos} min, ou chame a Mi no WhatsApp 💛`,
        code: "muitas_reservas",
      },
      { status: 429 },
    );
  }

  // A3 — a foto vira arquivo PRIVADO antes de tocar no motor. processPrivatePhoto
  // valida o conteúdo por magic bytes, então um base64 de qualquer outra coisa
  // morre aqui e não vira linha no banco.
  const { fotoBase64, ...dados } = parsed.data;
  let photoKey: string | undefined;
  if (fotoBase64) {
    try {
      const bruto = fotoBase64.replace(/^data:image\/\w+;base64,/, "");
      photoKey = await processPrivatePhoto(Buffer.from(bruto, "base64"));
    } catch {
      return NextResponse.json(
        {
          error: "Não consegui ler essa foto — tente outra?",
          code: "foto_invalida",
        },
        { status: 415 },
      );
    }
  }

  const result = await createBooking({ ...dados, photoKey });
  // Foto que subiu para um agendamento que não nasceu viraria órfã no volume.
  if (!result.ok && photoKey) {
    await deletePrivatePhoto(photoKey).catch(() => undefined);
  }
  if (!result.ok) {
    const status = STATUS_BY_CODE[result.code] ?? 400;
    return NextResponse.json(
      { error: result.message, code: result.code },
      { status },
    );
  }
  // Alimenta o teto por IP da próxima requisição. Best-effort e com o telefone
  // mascarado (••••7766) — o log de auditoria nunca guarda PII completa.
  await recordAuth(
    "cliente",
    "booking_create",
    maskPhone(parsed.data.customer.phone),
    meta,
  );

  // Tracking F1 (server-authoritative): a cliente concluiu o fluxo de agendar.
  // serviceId não é PII; sanitizeMeta descarta o que não for primitivo simples.
  await track({
    tipo: EV.AGENDAMENTO_CONCLUIDO,
    sessionId: getSid(),
    clientId: (await getClienteSession())?.customerId ?? null,
    metadata: { servico: parsed.data.serviceId, local: parsed.data.location },
  });

  const res = NextResponse.json(
    {
      id: result.id,
      holdExpiresAt: result.holdExpiresAt,
      // A7: o wizard usa isto para NÃO chamar /confirm quando há sinal — antes
      // ele chamava sempre, tomava 402 e mostrava a recusa como erro de
      // formulário, como se a reserva não existisse.
      aguardandoSinal: result.aguardandoSinal,
      depositCents: result.depositCents,
    },
    { status: 201 },
  );

  // Comprovante de posse: é isto que `/confirm` vai exigir. Fica só neste
  // navegador, vale só para esta reserva e vence junto com o horário guardado.
  //
  // Best-effort de propósito. A reserva JÁ ESTÁ no banco e a Mi JÁ FOI avisada
  // quando chegamos aqui: deixar uma exceção subir (o `NEXTAUTH_SECRET` sumir
  // do Dokploy, por exemplo) devolveria 500 para um agendamento que existe, a
  // cliente tentaria de novo e bateria no teto por telefone achando que nada
  // funcionou. Sem o comprovante ela cai no 403 do /confirm e a Mi confirma
  // pelo painel — caminho pior, mas honesto.
  try {
    const validade = validadeDaPosse(result.holdExpiresAt);
    res.cookies.set(
      nomeCookiePosse(result.id),
      assinarPosse(result.id, validade),
      opcoesCookie(validade.getTime() - Date.now()),
    );
  } catch (e) {
    console.error("posse: não consegui emitir o comprovante", result.id, e);
  }
  return res;
}
