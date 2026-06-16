import { prisma } from "./prisma";

/**
 * CMS leve (Onda B): textos das páginas editáveis pela Mi, por chave.
 * O DEFAULT de cada texto vive aqui (registry) — a tabela site_content guarda
 * só os overrides. Assim o site nunca quebra/esvazia se uma chave não foi
 * editada, e novas chaves entram com texto pronto.
 */

export interface ContentField {
  key: string;
  label: string;
  default: string;
  multiline?: boolean;
  /** Agrupa no editor do admin. */
  grupo: string;
}

/** Registry — fonte da verdade dos textos editáveis. Adicione chaves aqui. */
export const CONTENT_FIELDS: ContentField[] = [
  {
    key: "home.hero.eyebrow",
    label: "Home · linha de cima",
    default: "Milene Ozorio · Beauty Artist · RJ",
    grupo: "Início",
  },
  {
    key: "home.hero.title",
    label: "Home · título principal",
    default: "Sua beleza, realçada com cuidado e arte",
    grupo: "Início",
  },
  {
    key: "home.hero.subtitle",
    label: "Home · subtítulo",
    default:
      "Maquiagem e penteado para noivas, debutantes e os seus momentos mais especiais, no coração do Rio de Janeiro. 💛",
    multiline: true,
    grupo: "Início",
  },
  {
    key: "home.hero.cta_primary",
    label: "Home · botão principal",
    default: "Agendar meu horário",
    grupo: "Início",
  },
  {
    key: "home.hero.cta_secondary",
    label: "Home · botão secundário",
    default: "Sou noiva ou debutante 💛",
    grupo: "Início",
  },
  {
    key: "sobre.hero.title",
    label: "Sobre · título",
    default: "12 anos realçando belezas",
    grupo: "Sobre a Mi",
  },
  {
    key: "sobre.hero.p1",
    label: "Sobre · primeiro parágrafo",
    default:
      "Sou a Milene — Mi, pra você. Há mais de uma década cuido da beleza de noivas, debutantes e mulheres em seus momentos mais especiais, com técnica, sensibilidade e muito carinho.",
    multiline: true,
    grupo: "Sobre a Mi",
  },
  {
    key: "sobre.hero.p2",
    label: "Sobre · segundo parágrafo",
    default:
      "Acredito que maquiagem boa é aquela que realça quem você já é — então cada produção começa te ouvindo, entendendo a sua história e a ocasião.",
    multiline: true,
    grupo: "Sobre a Mi",
  },
  {
    key: "sobre.estudio.texto",
    label: "Sobre · texto do estúdio",
    default:
      "Um ambiente familiar e climatizado, com manequim para o vestido e capacidade para até 6 pessoas (incluindo as profissionais de beleza). O lugar perfeito para a sua prévia e o seu grande dia.",
    multiline: true,
    grupo: "Sobre a Mi",
  },
  {
    key: "sobre.estudio.endereco",
    label: "Sobre · endereço do estúdio",
    default: "Rua Ipoméia, 5 — Vila Maria, Santíssimo, Rio de Janeiro",
    grupo: "Sobre a Mi",
  },
  {
    key: "home.especiais.subtitle",
    label: "Home · subtítulo de Noivas & Debutantes",
    default:
      "Atendimentos exclusivos, com reunião, prévia e todo o cuidado do grande dia.",
    multiline: true,
    grupo: "Início",
  },
  {
    key: "home.cta.title",
    label: "Home · chamada final (título)",
    default: "Vamos cuidar da sua beleza?",
    grupo: "Início",
  },
  {
    key: "home.cta.subtitle",
    label: "Home · chamada final (texto)",
    default: "Escolha o seu horário em poucos toques. Estou te esperando 💛",
    multiline: true,
    grupo: "Início",
  },
  {
    key: "home.cta.button",
    label: "Home · chamada final (botão)",
    default: "Agendar meu horário",
    grupo: "Início",
  },
  {
    key: "diaadia.intro.title",
    label: "Dia a dia · título",
    default: "Dia a dia",
    grupo: "Dia a dia",
  },
  {
    key: "diaadia.intro.subtitle",
    label: "Dia a dia · texto de introdução",
    default:
      "Cuidado de perto, no seu ritmo. Cabelo e sobrancelhas para você se sentir bem todos os dias — não só nas ocasiões especiais. 💛",
    multiline: true,
    grupo: "Dia a dia",
  },
];

const DEFAULTS: Record<string, string> = Object.fromEntries(
  CONTENT_FIELDS.map((f) => [f.key, f.default]),
);

const TTL_MS = 60_000;
let cache: { at: number; data: Record<string, string> } | null = null;

/**
 * Mapa key→texto, com defaults do registry sobrepostos pelos overrides do
 * banco. Nunca lança: sem banco (build/prerender) devolve os defaults.
 */
export async function getSiteContent(): Promise<Record<string, string>> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.data;
  try {
    const rows = await prisma.siteContent.findMany();
    const data = { ...DEFAULTS };
    for (const r of rows) if (r.key in DEFAULTS) data[r.key] = r.value;
    cache = { at: Date.now(), data };
    return data;
  } catch {
    return { ...DEFAULTS };
  }
}

export function invalidateContentCache(): void {
  cache = null;
}
