import { prisma } from "@/lib/prisma";
import { CONTENT_FIELDS } from "@/lib/content";
import SubmitButton from "@/components/admin/SubmitButton";
import { adminSetContent } from "../actions";

export const dynamic = "force-dynamic";

export default async function AdminConteudoPage() {
  const rows = await prisma.siteContent.findMany();
  const override = new Map(rows.map((r) => [r.key, r.value]));

  // Agrupa os campos por seção (grupo) preservando a ordem do registry.
  const grupos: { nome: string; campos: typeof CONTENT_FIELDS }[] = [];
  for (const f of CONTENT_FIELDS) {
    let g = grupos.find((x) => x.nome === f.grupo);
    if (!g) {
      g = { nome: f.grupo, campos: [] };
      grupos.push(g);
    }
    g.campos.push(f);
  }

  return (
    <>
      <h1 className="mb-2 text-3xl">Textos do site</h1>
      <p className="mb-6 text-sm text-mi-texto/80">
        Edite os textos das páginas. Deixe um campo igual ao original (ou vazio)
        para voltar ao texto de fábrica. As mudanças aparecem no site ao salvar.
      </p>

      <form action={adminSetContent} className="space-y-8">
        {grupos.map((g) => (
          <section key={g.nome} className="rounded-mi bg-mi-branco p-5 shadow-suave">
            <h2 className="mb-4 font-titulo text-xl text-mi-marrom-escuro">
              {g.nome}
            </h2>
            <div className="space-y-4">
              {g.campos.map((f) => {
                const value = override.get(f.key) ?? f.default;
                return (
                  <label key={f.key} className="block text-xs">
                    {f.label}
                    {f.multiline ? (
                      <textarea
                        name={f.key}
                        defaultValue={value}
                        rows={3}
                        className="input-mi mt-1 w-full"
                      />
                    ) : (
                      <input
                        name={f.key}
                        defaultValue={value}
                        className="input-mi mt-1 w-full !py-2"
                      />
                    )}
                    {f.ajuda && (
                      <span className="mt-1 block text-[11px] text-mi-texto/80">
                        {f.ajuda}
                      </span>
                    )}
                  </label>
                );
              })}
            </div>
          </section>
        ))}
        <SubmitButton
          pendingLabel="Salvando…"
          className="rounded-mi bg-mi-marrom-escuro px-6 py-3 text-white"
        >
          Salvar textos
        </SubmitButton>
      </form>
    </>
  );
}
