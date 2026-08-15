import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { hashResetToken } from "@/lib/security";
import ResetForm from "./ResetForm";

export const dynamic = "force-dynamic";

/** Página de redefinição de senha (M13.4). Valida o token antes de mostrar o form. */
export default async function RedefinirPage({
  params,
}: {
  params: { token: string };
}) {
  const row = await prisma.passwordResetToken
    .findUnique({ where: { tokenHash: hashResetToken(params.token) } })
    .catch(() => null);
  const valido = row && !row.usedAt && row.expiresAt > new Date();

  return (
    <div className="mx-auto max-w-sm">
      <h1 className="mb-2 text-3xl">Nova senha</h1>
      {valido ? (
        <>
          <p className="mb-8 text-sm text-mi-texto/80">
            Crie uma nova senha para sua conta do painel.
          </p>
          <ResetForm token={params.token} />
        </>
      ) : (
        <>
          <p className="mb-6 rounded-mi bg-red-50 px-4 py-3 text-sm text-red-800">
            Esse link expirou ou já foi usado.
          </p>
          <Link href="/admin/recuperar" className="text-mi-marrom underline">
            Pedir um novo link
          </Link>
        </>
      )}
    </div>
  );
}
