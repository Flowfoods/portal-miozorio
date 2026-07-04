import { prisma } from "./prisma";
import { getSettings } from "./settings";
import { dispatchEvent } from "./notify";
import { processPrivatePhoto, deletePrivatePhoto } from "./media";
import { revalidatePath } from "next/cache";

/**
 * Momentos (F3 — Área da Cliente): a cliente conta como foi (texto + nota +
 * fotos) e a Mi modera. Conteúdo só vai ao site com status 'aprovado' e
 * consentimento registrado (LGPD).
 *
 * Segurança (sec-audit-fraud-guard):
 *  - toda operação de cliente recebe o customerId da SESSÃO (nunca do form);
 *  - fotos: allowlist de mime + magic bytes no servidor + limite 8MB + sharp
 *    reprocessa (WebP 1600px, EXIF/geo removidos) + store PRIVADO (priv/);
 *  - rate limit: máx. 3 momentos pendentes por cliente;
 *  - pontos: crédito idempotente por dedup_key, só na PRIMEIRA aprovação
 *    (edição/re-aprovação não gera novo crédito — anti-farm).
 */

export const MOMENTO_MAX_CHARS = 600;
export const MOMENTO_MAX_FOTOS = 4;
export const MOMENTO_MAX_PENDENTES = 3;
export const MOMENTO_MAX_FOTO_BYTES = 8 * 1024 * 1024;

const MIMES_ACEITOS = new Set(["image/jpeg", "image/png", "image/webp"]);

/** Valida assinatura real do arquivo (magic bytes) — nunca só o mime/extensão. */
export function isImagemValida(buf: Buffer): boolean {
  if (buf.length < 12) return false;
  // JPEG: FF D8 FF
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return true;
  // PNG: 89 50 4E 47
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47)
    return true;
  // WebP: "RIFF"...."WEBP"
  if (
    buf.toString("ascii", 0, 4) === "RIFF" &&
    buf.toString("ascii", 8, 12) === "WEBP"
  )
    return true;
  return false;
}

/** Nome público da cliente na vitrine: "Linda S." (primeiro nome + inicial). */
export function nomePublico(nomeCompleto: string): string {
  const partes = nomeCompleto.trim().split(/\s+/);
  const primeiro = partes[0] ?? "";
  const inicial = partes.length > 1 ? ` ${partes[partes.length - 1]![0]}.` : "";
  return `${primeiro}${inicial}`;
}

export type MomentoResult =
  | { ok: true; id: string }
  | { ok: false; message: string };

interface EnviarMomentoInput {
  customerId: string;
  texto: string;
  rating: number | null;
  bookingId: string | null;
  fotos: { buffer: Buffer; mimeType: string }[];
  consentiu: boolean;
}

/** Cliente envia um momento → status 'pendente' + aviso à Mi. */
export async function enviarMomento(
  input: EnviarMomentoInput,
): Promise<MomentoResult> {
  const texto = input.texto.trim();
  if (texto.length < 5) return { ok: false, message: "Conte um pouquinho mais 💛" };
  if (texto.length > MOMENTO_MAX_CHARS)
    return { ok: false, message: `O depoimento pode ter até ${MOMENTO_MAX_CHARS} caracteres.` };
  if (input.rating !== null && (input.rating < 1 || input.rating > 5))
    return { ok: false, message: "Nota inválida." };
  if (!input.consentiu)
    return {
      ok: false,
      message: "Para enviar, autorize a exibição do seu depoimento.",
    };
  if (input.fotos.length > MOMENTO_MAX_FOTOS)
    return { ok: false, message: `Até ${MOMENTO_MAX_FOTOS} fotos por momento.` };

  // Rate limit: 3 pendentes por cliente.
  const pendentes = await prisma.testimonial.count({
    where: { customerId: input.customerId, status: "pendente" },
  });
  if (pendentes >= MOMENTO_MAX_PENDENTES)
    return {
      ok: false,
      message:
        "Você já tem envios aguardando a Mi. Assim que ela ler, você pode contar mais 💛",
    };

  const customer = await prisma.customer.findUnique({
    where: { id: input.customerId },
    select: { name: true, phoneE164: true },
  });
  if (!customer) return { ok: false, message: "Conta não encontrada." };

  // Booking vinculado precisa ser DELA e concluído (isolamento).
  if (input.bookingId) {
    const b = await prisma.booking.findFirst({
      where: {
        id: input.bookingId,
        customerId: input.customerId,
        status: "completed",
      },
      select: { id: true },
    });
    if (!b) return { ok: false, message: "Atendimento não encontrado." };
  }

  // Fotos: valida (mime + magic bytes + tamanho) e processa TODAS antes de
  // gravar qualquer coisa no banco — falhou uma, não cria nada.
  const chaves: string[] = [];
  for (const foto of input.fotos) {
    if (!MIMES_ACEITOS.has(foto.mimeType))
      return { ok: false, message: "Formato de foto não suportado (use JPG, PNG ou WebP)." };
    if (foto.buffer.length > MOMENTO_MAX_FOTO_BYTES)
      return { ok: false, message: "Cada foto pode ter até 8MB." };
    if (!isImagemValida(foto.buffer))
      return { ok: false, message: "Arquivo de foto inválido." };
    try {
      chaves.push(await processPrivatePhoto(foto.buffer));
    } catch {
      return { ok: false, message: "Não consegui processar uma das fotos. Tenta outra?" };
    }
  }

  const criado = await prisma.testimonial.create({
    data: {
      quote: texto,
      author: nomePublico(customer.name),
      published: false,
      status: "pendente",
      origem: "cliente",
      customerId: input.customerId,
      bookingId: input.bookingId,
      rating: input.rating,
      consentimentoPublicoAt: new Date(),
      enviadoEm: new Date(),
      photos: {
        create: chaves.map((fileKey, i) => ({ fileKey, ordem: i })),
      },
    },
  });

  // Aviso à Mi (best-effort, idempotente) — número do estúdio.
  await dispatchEvent({
    kind: "momento_pendente",
    dedupKey: `momento_pendente:${criado.id}`,
    data: { nome: customer.name, telefone: "+5521970225231" },
  });

  return { ok: true, id: criado.id };
}

interface EditarMomentoInput {
  customerId: string;
  testimonialId: string;
  texto: string;
  rating: number | null;
  removerFotoIds: string[];
  novasFotos: { buffer: Buffer; mimeType: string }[];
}

/** Cliente edita o próprio momento → volta para 'pendente' (re-moderação). */
export async function editarMomento(
  input: EditarMomentoInput,
): Promise<MomentoResult> {
  const texto = input.texto.trim();
  if (texto.length < 5) return { ok: false, message: "Conte um pouquinho mais 💛" };
  if (texto.length > MOMENTO_MAX_CHARS)
    return { ok: false, message: `O depoimento pode ter até ${MOMENTO_MAX_CHARS} caracteres.` };
  if (input.rating !== null && (input.rating < 1 || input.rating > 5))
    return { ok: false, message: "Nota inválida." };

  // Só o dono edita (isolamento) — e arquivado não volta.
  const atual = await prisma.testimonial.findFirst({
    where: {
      id: input.testimonialId,
      customerId: input.customerId,
      origem: "cliente",
      status: { in: ["pendente", "aprovado", "rejeitado"] },
    },
    include: { photos: true },
  });
  if (!atual) return { ok: false, message: "Depoimento não encontrado." };

  const remover = atual.photos.filter((p) => input.removerFotoIds.includes(p.id));
  const restantes = atual.photos.length - remover.length;
  if (restantes + input.novasFotos.length > MOMENTO_MAX_FOTOS)
    return { ok: false, message: `Até ${MOMENTO_MAX_FOTOS} fotos por momento.` };

  const chavesNovas: string[] = [];
  for (const foto of input.novasFotos) {
    if (!MIMES_ACEITOS.has(foto.mimeType))
      return { ok: false, message: "Formato de foto não suportado (use JPG, PNG ou WebP)." };
    if (foto.buffer.length > MOMENTO_MAX_FOTO_BYTES)
      return { ok: false, message: "Cada foto pode ter até 8MB." };
    if (!isImagemValida(foto.buffer))
      return { ok: false, message: "Arquivo de foto inválido." };
    try {
      chavesNovas.push(await processPrivatePhoto(foto.buffer));
    } catch {
      return { ok: false, message: "Não consegui processar uma das fotos. Tenta outra?" };
    }
  }

  const proxOrdem = Math.max(0, ...atual.photos.map((p) => p.ordem + 1));
  await prisma.$transaction([
    prisma.testimonialPhoto.deleteMany({
      where: { id: { in: remover.map((p) => p.id) }, testimonialId: atual.id },
    }),
    prisma.testimonial.update({
      where: { id: atual.id },
      data: {
        quote: texto,
        rating: input.rating,
        status: "pendente", // edição SEMPRE volta pra moderação
        published: false,
        motivoRejeicao: null,
        enviadoEm: new Date(),
        photos: {
          create: chavesNovas.map((fileKey, i) => ({
            fileKey,
            ordem: proxOrdem + i,
          })),
        },
      },
    }),
  ]);

  // Arquivos das fotos removidas (best-effort, depois da tx).
  for (const p of remover) await deletePrivatePhoto(p.fileKey);
  // Se estava no ar, sai do ar até re-aprovação.
  revalidatePath("/");
  return { ok: true, id: atual.id };
}

/** Cliente exclui o próprio momento — some do site imediatamente (LGPD). */
export async function excluirMomento(
  customerId: string,
  testimonialId: string,
): Promise<MomentoResult> {
  const atual = await prisma.testimonial.findFirst({
    where: { id: testimonialId, customerId, origem: "cliente" },
    include: { photos: true },
  });
  if (!atual) return { ok: false, message: "Depoimento não encontrado." };

  await prisma.testimonial.delete({ where: { id: atual.id } }); // cascade nas fotos
  for (const p of atual.photos) await deletePrivatePhoto(p.fileKey);
  revalidatePath("/");
  return { ok: true, id: atual.id };
}

// ── Moderação (admin) ────────────────────────────────────────────────────────

/**
 * Mi aprova: publica + credita pontos (idempotente — só na 1ª aprovação) +
 * avisa a cliente. moderadoPor = e-mail da admin logada.
 */
export async function aprovarMomento(
  testimonialId: string,
  moderadoPor: string,
): Promise<void> {
  const t = await prisma.testimonial.findUnique({
    where: { id: testimonialId },
    include: {
      customer: { select: { name: true, phoneE164: true } },
      photos: true,
    },
  });
  if (!t || t.origem !== "cliente") return;

  // Primeira aprovação? (moderadoEm lido ANTES do update). Pontos só na 1ª vez:
  // blinda re-aprovação após edição — inclusive troca de fotos, cujos ids
  // novos escapariam do dedup por-foto (anti-farm). Belt-and-suspenders com o
  // dedup_key único no banco.
  const primeiraAprovacao = t.moderadoEm === null;

  await prisma.testimonial.update({
    where: { id: t.id },
    data: {
      status: "aprovado",
      published: true,
      motivoRejeicao: null,
      moderadoEm: new Date(),
      moderadoPor,
    },
  });

  // Pontos (R3: configuráveis, default 0 = desligado). 1x por depoimento na vida.
  let pontosCreditados = 0;
  if (t.customerId && primeiraAprovacao) {
    const s = await getSettings();
    if (s.clubPointsDepoimento > 0) {
      const criou = await prisma.clubTransaction
        .create({
          data: {
            customerId: t.customerId,
            pontos: s.clubPointsDepoimento,
            tipo: "depoimento",
            descricao: "Depoimento aprovado 💛",
            dedupKey: `depoimento:${t.id}`,
          },
        })
        .then(
          () => true,
          (e) => {
            if (String((e as { code?: string })?.code).includes("P2002")) return false;
            throw e;
          },
        );
      if (criou) pontosCreditados += s.clubPointsDepoimento;
    }
    if (s.clubPointsFoto > 0) {
      for (const p of t.photos.filter((p) => p.aprovada)) {
        const criou = await prisma.clubTransaction
          .create({
            data: {
              customerId: t.customerId,
              pontos: s.clubPointsFoto,
              tipo: "foto",
              descricao: "Foto aprovada 💛",
              dedupKey: `foto:${p.id}`,
            },
          })
          .then(
            () => true,
            (e) => {
              if (String((e as { code?: string })?.code).includes("P2002")) return false;
              throw e;
            },
          );
        if (criou) pontosCreditados += s.clubPointsFoto;
      }
    }
  }

  if (t.customer) {
    await dispatchEvent({
      kind: "momento_aprovado",
      // Re-aprovações (após edição) avisam de novo: dedup por moderação.
      dedupKey: `momento_aprovado:${t.id}:${Date.now()}`,
      data: {
        nome: t.customer.name,
        telefone: t.customer.phoneE164,
        pontos: pontosCreditados > 0 ? String(pontosCreditados) : "",
      },
    });
  }

  revalidatePath("/");
  revalidatePath("/admin/depoimentos");
}

/** Mi decide não publicar: aviso gentil, com convite a reenviar. */
export async function rejeitarMomento(
  testimonialId: string,
  moderadoPor: string,
  motivo?: string,
): Promise<void> {
  const t = await prisma.testimonial.findUnique({
    where: { id: testimonialId },
    include: { customer: { select: { name: true, phoneE164: true } } },
  });
  if (!t || t.origem !== "cliente") return;

  await prisma.testimonial.update({
    where: { id: t.id },
    data: {
      status: "rejeitado",
      published: false,
      motivoRejeicao: motivo?.trim() || null,
      moderadoEm: new Date(),
      moderadoPor,
    },
  });

  if (t.customer) {
    await dispatchEvent({
      kind: "momento_nao_publicado",
      dedupKey: `momento_nao_publicado:${t.id}:${Date.now()}`,
      data: { nome: t.customer.name, telefone: t.customer.phoneE164 },
    });
  }

  revalidatePath("/");
  revalidatePath("/admin/depoimentos");
}

/** Contagem da fila (badge do admin). */
export async function contarMomentosPendentes(): Promise<number> {
  try {
    return await prisma.testimonial.count({ where: { status: "pendente" } });
  } catch {
    return 0;
  }
}
