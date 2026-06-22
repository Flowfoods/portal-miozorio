import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/auth";
import { MIN_SENHA } from "@/lib/security";
import {
  adminCreateUser,
  adminToggleUser,
  adminResetUserPassword,
  adminUpdateUser,
} from "../actions";

export const dynamic = "force-dynamic";

export default async function AdminUsuariasPage() {
  const [session, users] = await Promise.all([
    getAdminSession(),
    prisma.adminUser.findMany({ orderBy: { createdAt: "asc" } }),
  ]);
  const myEmail = session?.user?.email?.toLowerCase();

  return (
    <>
      <h1 className="mb-2 text-3xl">Usuárias do painel</h1>
      <p className="mb-6 text-sm text-mi-texto/70">
        Quem pode entrar no painel do estúdio. Não existe cadastro pelo site —
        contas só são criadas aqui.
      </p>

      <details className="mb-6 rounded-mi bg-mi-branco p-4 shadow-suave">
        <summary className="cursor-pointer font-titulo text-lg text-mi-marrom-escuro">
          ＋ Nova conta
        </summary>
        <form
          action={adminCreateUser}
          className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_1fr_auto]"
        >
          <label className="text-xs">
            Nome
            <input className="input-mi mt-1 !py-2" name="name" required />
          </label>
          <label className="text-xs">
            E-mail
            <input
              className="input-mi mt-1 !py-2"
              name="email"
              type="email"
              required
            />
          </label>
          <label className="text-xs">
            Senha (mín. {MIN_SENHA})
            <input
              className="input-mi mt-1 !py-2"
              name="password"
              type="password"
              minLength={MIN_SENHA}
              required
            />
          </label>
          <button className="self-end rounded-mi bg-mi-marrom px-4 py-2.5 text-sm text-white">
            Criar conta
          </button>
        </form>
      </details>

      <div className="space-y-3">
        {users.map((u) => {
          const isMe = u.email === myEmail;
          return (
            <div
              key={u.id}
              className="rounded-mi bg-mi-branco p-4 shadow-suave"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-medium">
                    {u.name}{" "}
                    {isMe && (
                      <span className="text-xs text-mi-marrom">(você)</span>
                    )}
                  </p>
                  <p className="text-sm text-mi-texto/70">{u.email}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className={`rounded-full px-3 py-1 text-xs ${
                      u.active
                        ? "bg-emerald-100 text-emerald-900"
                        : "bg-red-100 text-red-900"
                    }`}
                  >
                    {u.active ? "ativa" : "desativada"}
                  </span>
                  {!isMe && (
                    <form action={adminToggleUser.bind(null, u.id)}>
                      <button className="rounded-mi border border-mi-cinza px-3 py-1.5 text-sm">
                        {u.active ? "Desativar" : "Reativar"}
                      </button>
                    </form>
                  )}
                </div>
              </div>
              <details className="mt-3">
                <summary className="cursor-pointer text-sm text-mi-marrom">
                  Editar nome e e-mail
                </summary>
                <form
                  action={adminUpdateUser}
                  className="mt-2 flex flex-wrap items-end gap-2"
                >
                  <input type="hidden" name="id" value={u.id} />
                  <label className="text-xs">
                    Nome
                    <input
                      className="input-mi mt-1 !py-2"
                      name="name"
                      defaultValue={u.name}
                      required
                    />
                  </label>
                  <label className="text-xs">
                    E-mail
                    <input
                      className="input-mi mt-1 !py-2"
                      name="email"
                      type="email"
                      defaultValue={u.email}
                      required
                    />
                  </label>
                  <button className="rounded-mi border border-mi-cinza px-3 py-2 text-sm">
                    Salvar
                  </button>
                </form>
                {isMe && (
                  <p className="mt-1 text-xs text-mi-texto/60">
                    Se trocar o próprio e-mail, entre de novo com o novo
                    endereço.
                  </p>
                )}
              </details>
              <form
                action={adminResetUserPassword}
                className="mt-3 flex flex-wrap items-end gap-2"
              >
                <input type="hidden" name="id" value={u.id} />
                <label className="text-xs">
                  Nova senha (mín. {MIN_SENHA})
                  <input
                    className="input-mi mt-1 !py-2"
                    name="password"
                    type="password"
                    minLength={MIN_SENHA}
                    required
                  />
                </label>
                <button className="rounded-mi border border-mi-cinza px-3 py-2 text-sm">
                  Trocar senha
                </button>
              </form>
            </div>
          );
        })}
      </div>
    </>
  );
}
