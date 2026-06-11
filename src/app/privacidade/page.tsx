import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo";

export const metadata: Metadata = pageMeta({
  path: "/privacidade",
  title: "Política de Privacidade · Mi Ozorio",
  description:
    "Como a Milene Ozorio Beauty Artist trata os seus dados, com cuidado e respeito à LGPD.",
  ogTitle: "Política de Privacidade",
});

export default function PrivacidadePage() {
  return (
    <main className="mx-auto max-w-2xl px-5 py-16">
      <h1 className="font-titulo text-4xl text-mi-marrom-escuro">
        Política de Privacidade
      </h1>
      <p className="mt-3 font-corpo text-sm text-mi-marrom">
        Seus dados são tratados com o mesmo cuidado que eu tenho com a sua
        beleza. 💛
      </p>

      <div className="mt-8 space-y-6 font-corpo text-mi-texto">
        <section>
          <h2 className="font-titulo text-2xl text-mi-marrom-escuro">
            Quais dados eu coleto
          </h2>
          <p className="mt-2 text-sm">
            Nome, WhatsApp e e-mail (opcional) para organizar o seu agendamento e
            falar com você; e as respostas da anamnese (alergias, referências e
            ocasião) para preparar o melhor atendimento.
          </p>
        </section>

        <section>
          <h2 className="font-titulo text-2xl text-mi-marrom-escuro">
            Dados sensíveis e de menores
          </h2>
          <p className="mt-2 text-sm">
            Informações sobre alergias são tratadas como dado de saúde, com
            acesso restrito apenas ao painel da Mi. No caso de debutantes
            (menores de idade), a captação e o contato são sempre feitos com o
            responsável.
          </p>
        </section>

        <section>
          <h2 className="font-titulo text-2xl text-mi-marrom-escuro">
            Fotos do resultado
          </h2>
          <p className="mt-2 text-sm">
            Só publico fotos do seu atendimento com a sua autorização — e você
            pode mudar de ideia quando quiser.
          </p>
        </section>

        <section>
          <h2 className="font-titulo text-2xl text-mi-marrom-escuro">
            Seus direitos
          </h2>
          <p className="mt-2 text-sm">
            Você pode pedir acesso, correção ou exclusão dos seus dados a
            qualquer momento, é só me chamar no WhatsApp{" "}
            <a
              href="https://wa.me/5521970225231"
              className="underline"
            >
              (21) 97022-5231
            </a>
            .
          </p>
        </section>

        <p className="text-xs text-mi-marrom">
          Esta é a versão inicial da nossa política e será detalhada em breve.
        </p>
      </div>
    </main>
  );
}
