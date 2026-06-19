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
  /** Dica exibida abaixo do campo (ex.: placeholders disponíveis). */
  ajuda?: string;
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
  // ── Noivas ──
  {
    key: "noivas.hero.eyebrow",
    label: "Noivas · linha de cima",
    default: "La Mariée",
    grupo: "Noivas",
  },
  {
    key: "noivas.hero.title",
    label: "Noivas · título",
    default: "O seu dia merece exclusividade",
    grupo: "Noivas",
  },
  {
    key: "noivas.hero.subtitle",
    label: "Noivas · subtítulo",
    default:
      "Uma experiência pensada nos mínimos detalhes — da primeira conversa ao último retoque antes do “sim”. 💛",
    multiline: true,
    grupo: "Noivas",
  },
  {
    key: "noivas.cta.title",
    label: "Noivas · chamada final (título)",
    default: "Vamos criar a sua produção dos sonhos?",
    grupo: "Noivas",
  },
  {
    key: "noivas.cta.subtitle",
    label: "Noivas · chamada final (texto)",
    default:
      "Cada noiva é única, então preparo uma proposta personalizada pra você. Me chama no WhatsApp 💛",
    multiline: true,
    grupo: "Noivas",
  },
  {
    key: "noivas.cta.button",
    label: "Noivas · chamada final (botão)",
    default: "Quero uma proposta",
    grupo: "Noivas",
  },
  // ── Debutantes ──
  {
    key: "debutantes.hero.eyebrow",
    label: "Debutantes · linha de cima",
    default: "15 anos",
    grupo: "Debutantes",
  },
  {
    key: "debutantes.hero.title",
    label: "Debutantes · título",
    default: "O brilho da debutante, do nosso jeito",
    grupo: "Debutantes",
  },
  {
    key: "debutantes.hero.subtitle",
    label: "Debutantes · subtítulo",
    default:
      "Da reunião criativa ao acompanhamento na festa — com todo o cuidado que esse dia tão especial merece. 💛",
    multiline: true,
    grupo: "Debutantes",
  },
  {
    key: "debutantes.cta.title",
    label: "Debutantes · chamada final (título)",
    default: "Bora planejar essa festa?",
    grupo: "Debutantes",
  },
  {
    key: "debutantes.cta.subtitle",
    label: "Debutantes · chamada final (texto)",
    default: "Me chama no WhatsApp que eu preparo uma proposta sob medida 💛",
    multiline: true,
    grupo: "Debutantes",
  },
  {
    key: "debutantes.cta.button",
    label: "Debutantes · chamada final (botão)",
    default: "Falar com a Mi",
    grupo: "Debutantes",
  },
  {
    key: "debutantes.ensaio.tabela",
    label: "Debutantes · tabela de ensaio externo (um item por linha: Nome | Preço)",
    default:
      "Maquiagem | R$ 380\nCabelo | R$ 450\nPacote (maquiagem + cabelo) | R$ 630\nAcompanhamento exclusivo no ensaio | R$ 1.500",
    multiline: true,
    grupo: "Debutantes",
  },
  // ── Mensagens automáticas de WhatsApp ──
  // As chaves "msg.*" alimentam as mensagens enviadas pela Mi:
  //  • club_points e booking_confirmation → enviadas pelo app (src/lib/notify.ts).
  //  • lembrete_24h, aniversario, aniversario_cliente, pos_atendimento, reconexao
  //    → enviadas pelo cron do n8n (lê site_content; ver n8n/README.md).
  // Placeholders entre chaves são trocados na hora do envio. {data} = data/hora.
  {
    key: "msg.club_points",
    label: "WhatsApp · pontos do Clube",
    default:
      "Oi, {nome}! 💛\n\nVocê ganhou {pontos} pontos no Clube Mi Ozorio{motivo}! Acompanhe seu saldo e troque por mimos quando quiser. 💛",
    multiline: true,
    grupo: "Mensagens de WhatsApp",
    ajuda: "Disponível: {nome}, {pontos}, {motivo} (opcional, já vem entre parênteses).",
  },
  {
    key: "msg.booking_confirmation",
    label: "WhatsApp · confirmação de horário",
    default:
      "Oi, {nome}! 💛\n\nSeu horário de {servico} está confirmado para {data}. Qualquer coisa, é só me chamar por aqui. Até logo! 💛",
    multiline: true,
    grupo: "Mensagens de WhatsApp",
    ajuda: "Disponível: {nome}, {servico}, {data} (data e hora).",
  },
  {
    key: "msg.lembrete_24h",
    label: "WhatsApp · lembrete da véspera",
    default:
      "Oi, {nome}! 💛\n\nPassando pra lembrar do seu horário de {servico} amanhã ({data}). Te espero! Se precisar remarcar, é só me chamar por aqui. 💛",
    multiline: true,
    grupo: "Mensagens de WhatsApp",
    ajuda: "Disponível: {nome}, {servico}, {data} (data e hora). Enviado pelo n8n.",
  },
  {
    key: "msg.aniversario",
    label: "WhatsApp · aniversário (membro do Clube)",
    default:
      "Feliz aniversário, {nome}! 💛\n\nQue seu dia seja tão lindo quanto você. Passa aqui pra gente comemorar com um cuidado especial. 💛",
    multiline: true,
    grupo: "Mensagens de WhatsApp",
    ajuda: "Disponível: {nome}. Enviado pelo n8n.",
  },
  {
    key: "msg.aniversario_cliente",
    label: "WhatsApp · 1 ano de cliente",
    default:
      "Oi, {nome}! 💛\n\nFaz 1 ano que a gente se conheceu — obrigada pela confiança desde então. Bora marcar um próximo encontro?",
    multiline: true,
    grupo: "Mensagens de WhatsApp",
    ajuda: "Disponível: {nome}. Enviado pelo n8n.",
  },
  {
    key: "msg.pos_atendimento",
    label: "WhatsApp · pós-atendimento (dia seguinte)",
    default:
      "Oi, {nome}! 💛\n\nFoi um prazer te atender de {servico} ontem. Como você se sentiu? Se puder, me conta — e se topar, adoraria registrar o resultado (só com a sua autorização). 💛",
    multiline: true,
    grupo: "Mensagens de WhatsApp",
    ajuda: "Disponível: {nome}, {servico}. Enviado pelo n8n.",
  },
  {
    key: "msg.reconexao",
    label: "WhatsApp · reconexão (sem visita há mais de 1 ano)",
    default:
      "Oi, {nome}! 💛\n\nFaz um tempinho que a gente não se vê — saudades! Que tal remarcar um cuidado pra você? É só me chamar por aqui.",
    multiline: true,
    grupo: "Mensagens de WhatsApp",
    ajuda: "Disponível: {nome}. Enviado pelo n8n.",
  },
];

/**
 * Interpola um template de mensagem: troca {chave} pelo valor em `vars`.
 * Placeholders sem valor correspondente são removidos (não vazam "{xxx}").
 */
export function aplicarTemplate(
  tpl: string,
  vars: Record<string, string>,
): string {
  return tpl.replace(/\{(\w+)\}/g, (_m, k: string) =>
    k in vars ? vars[k]! : "",
  );
}

/**
 * Parser de "Rótulo | Valor" por linha → [{ o, v }]. Linhas sem "|" são
 * ignoradas. Usado na tabela de ensaio externo (debutantes).
 */
export function parseTabela(texto: string): { o: string; v: string }[] {
  return texto
    .split("\n")
    .map((l) => l.split("|"))
    .filter((p) => p.length >= 2)
    .map((p) => ({ o: p[0]!.trim(), v: p.slice(1).join("|").trim() }))
    .filter((r) => r.o && r.v);
}

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
