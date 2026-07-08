import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { evolutionStatus } from "@/lib/evolution-connect";
import WhatsAppConnect from "@/components/admin/WhatsAppConnect";

export const dynamic = "force-dynamic";

export default async function WhatsAppPage() {
  await requireAdmin();
  const inicial = await evolutionStatus();

  return (
    <>
      <div className="mb-2">
        <Link href="/admin/config" className="text-sm text-mi-marrom underline">
          ← Configurações
        </Link>
      </div>
      <h1 className="mb-2 text-3xl">Conectar o WhatsApp</h1>
      <p className="mb-6 max-w-xl text-sm text-mi-texto/70">
        É o WhatsApp que envia os lembretes de horário, as confirmações e o código
        de recuperação de senha das clientes. Conecte uma vez, como no WhatsApp
        Web — só precisa refazer se sair do ar.
      </p>
      <div className="max-w-md">
        <WhatsAppConnect inicial={inicial} />
      </div>
    </>
  );
}
