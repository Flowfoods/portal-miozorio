import { prisma } from "./prisma";

/**
 * Vitrine de noiva/debutante (Onda B). A Mi edita pacotes e FAQs no /admin;
 * sem linhas para a categoria, cai no fallback do código (nunca esvazia).
 */

export interface PacoteView {
  nome: string;
  preco: string;
  parcela: string | null;
  itens: string[];
  rodape: string | null;
  destaque: boolean;
}

export interface FaqView {
  pergunta: string;
  resposta: string;
}

type Categoria = "noiva" | "debutante";

const PACOTES_FALLBACK: Record<Categoria, PacoteView[]> = {
  noiva: [
    {
      nome: "Pacote Exclusivo",
      preco: "R$ 3.287",
      parcela: "à vista · ou sinal de R$ 300 + 12x R$ 291,60",
      itens: [
        "Exclusividade do dia (do preparo até a cerimônia)",
        "Preparação do cabelo + maquiagem à prova d'água",
        "Estruturação do penteado e colocação de véu, vestido e grinalda",
        "Prévia de maquiagem e penteado (1 mês antes, no estúdio, 3h)",
        "Deslocamento incluído (RJ)",
        "Produção de 2 acompanhantes (maquiagem + penteado)",
      ],
      rodape: "Cortesia: Cabelo + maquiagem do ensaio pré-wedding",
      destaque: false,
    },
    {
      nome: "Pacote Estúdio",
      preco: "R$ 2.365",
      parcela: "à vista · ou sinal de R$ 300 + 12x R$ 217,68",
      itens: [
        "Day Use de 6h no estúdio",
        "Preparação do cabelo + maquiagem à prova d'água",
        "Estruturação do penteado e colocação de véu, vestido e grinalda",
        "Prévia de maquiagem e penteado (1 mês antes, no estúdio, 3h)",
        "Deslocamento incluído (RJ)",
        "Produção de 1 acompanhante (maquiagem + penteado)",
      ],
      rodape: "Cortesia: Lanche + espumante",
      destaque: false,
    },
  ],
  debutante: [
    {
      nome: "Pacote Básico",
      preco: "R$ 2.979",
      parcela: "ou 10x R$ 297,90",
      itens: [
        "Reunião criativa (online ou presencial)",
        "Prévia de maquiagem (até 2 testes)",
        "Prévia de penteado (até 2 testes)",
        "Maquiagem e penteado no dia, conforme planejado",
        "Assistência com vestido, sapato e acessórios",
        "Assessoria durante o making of fotográfico",
        "Deslocamento incluído",
      ],
      rodape: null,
      destaque: false,
    },
    {
      nome: "Pacote Master",
      preco: "R$ 4.679",
      parcela: "ou 10x R$ 467,90",
      itens: [
        "Tudo do Básico, com até 3 testes em cada prévia",
        "Maquiagem e cabelo para ensaio externo",
        "Kit de emergência completo",
        "Produção de 1 acompanhante",
        "Acompanhamento de 4h na festa, com 2 retoques",
      ],
      rodape: null,
      destaque: true,
    },
  ],
};

const FAQS_FALLBACK: Record<Categoria, FaqView[]> = {
  noiva: [
    {
      pergunta: "Como funciona a prévia da noiva?",
      resposta:
        "A prévia acontece um mês antes do casamento, no estúdio, com 3h de duração — testamos maquiagem e penteado exatamente como serão no grande dia.",
    },
    {
      pergunta: "Preciso pagar sinal para reservar a data?",
      resposta:
        "A reserva da data é feita com R$ 300, que são abatidos do valor total do pacote, seguidos do alinhamento e da assinatura do contrato.",
    },
    {
      pergunta: "O deslocamento está incluído?",
      resposta:
        "Sim, o deslocamento está incluído dentro do Rio de Janeiro. Para outras cidades ou estados, combinamos taxa e hospedagem.",
    },
    {
      pergunta: "Quantos ajustes a prévia inclui?",
      resposta:
        "Até 3 ajustes de maquiagem estão inclusos. Acima disso, há uma taxa adicional de R$ 120.",
    },
    {
      pergunta: "Posso levar acompanhantes para se produzirem?",
      resposta:
        "Sim! O Pacote Exclusivo inclui a produção de 2 acompanhantes e o Pacote Estúdio inclui 1 acompanhante (maquiagem e penteado).",
    },
  ],
  debutante: [
    {
      pergunta: "A debutante precisa estar acompanhada?",
      resposta:
        "Sim. Como ela é menor de idade, a comunicação e o contrato são sempre com o responsável, e a prévia é acompanhada por ele.",
    },
    {
      pergunta: "Quantos testes a prévia inclui?",
      resposta:
        "No Pacote Básico são até 2 testes em cada prévia (maquiagem e penteado); no Master, até 3 testes em cada.",
    },
    {
      pergunta: "Vocês fazem ensaio externo?",
      resposta:
        "Sim! O ensaio externo pode ser contratado avulso (a partir de R$ 380) ou já vem incluso no Pacote Master.",
    },
    {
      pergunta: "Como funciona o pagamento?",
      resposta:
        "20% na assinatura do contrato e o restante até 3 dias antes da festa. No cartão, em até 10x sem juros; no PIX, parcelado sem juros.",
    },
    {
      pergunta: "O deslocamento está incluído?",
      resposta: "Sim, o deslocamento está incluído nos dois pacotes.",
    },
  ],
};

export async function getPacotes(categoria: Categoria): Promise<PacoteView[]> {
  try {
    const rows = await prisma.pacote.findMany({
      where: { categoria, ativo: true },
      orderBy: [{ sort: "asc" }, { createdAt: "asc" }],
    });
    if (rows.length === 0) return PACOTES_FALLBACK[categoria];
    return rows.map((r) => ({
      nome: r.nome,
      preco: r.preco,
      parcela: r.parcela,
      itens: r.itens,
      rodape: r.rodape,
      destaque: r.destaque,
    }));
  } catch {
    return PACOTES_FALLBACK[categoria];
  }
}

export async function getFaqs(categoria: Categoria): Promise<FaqView[]> {
  try {
    const rows = await prisma.faq.findMany({
      where: { categoria, ativo: true },
      orderBy: [{ sort: "asc" }, { createdAt: "asc" }],
    });
    if (rows.length === 0) return FAQS_FALLBACK[categoria];
    return rows.map((r) => ({ pergunta: r.pergunta, resposta: r.resposta }));
  } catch {
    return FAQS_FALLBACK[categoria];
  }
}
