import { getAdminSession } from "./auth";
import { getClienteSession } from "./cliente-auth";
import { prisma } from "./prisma";
import type { Area } from "./webauthn";

/**
 * Resolve o sujeito logado de uma área (Auth F3). O `subjectId` NUNCA vem do
 * request — sempre da sessão (admin via NextAuth, cliente via cookie). Usado
 * pelas rotas de cadastro/gerência de passkey.
 */
export async function sujeitoAtual(
  area: Area,
): Promise<{ subjectId: string; userName: string } | null> {
  if (area === "admin") {
    const s = await getAdminSession();
    if (!s?.user?.email) return null;
    const u = await prisma.adminUser.findUnique({
      where: { email: s.user.email },
      select: { id: true, email: true },
    });
    return u ? { subjectId: u.id, userName: u.email } : null;
  }
  const s = getClienteSession();
  if (!s) return null;
  const c = await prisma.customer.findUnique({
    where: { id: s.customerId },
    select: { id: true, name: true, phoneE164: true },
  });
  return c ? { subjectId: c.id, userName: c.name || c.phoneE164 } : null;
}

/** Passkeys de um sujeito (para listar/gerenciar). */
export function listarPasskeysDoSujeito(area: Area, subjectId: string) {
  return prisma.passkey.findMany({
    where: { area, subjectId },
    orderBy: { createdAt: "desc" },
    select: { id: true, deviceName: true, createdAt: true, lastUsedAt: true },
  });
}
