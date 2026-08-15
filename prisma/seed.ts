import { PrismaClient, Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

// ─────────────────────────────────────────────────────────────────────────────
// Seed de negócio (M1.2). Fonte: skill miespecialista + master prompt.
// R3: tudo aqui é dado editável no painel (M5), não hardcode no código.
//
// ⚠️ DURAÇÕES marcadas com "// ~confirmar" são ESTIMATIVAS (a skill só define a
//    do curso = 120min). A Mi ajusta no admin sem deploy. Confirmar com o Rodolfo.
// ⚠️ SOBRANCELHA: preços a confirmar → price_cents=0 + pending_price=true.
// ─────────────────────────────────────────────────────────────────────────────

const BRL = (reais: number) => Math.round(reais * 100);

const businessSettings: Record<string, Prisma.InputJsonValue> = {
  working_hours: {
    mon: [],
    tue: [],
    wed: [],
    thu: [],
    fri: [],
    sat: [["09:00", "19:00"]],
    sun: [["09:00", "19:00"]],
  },
  // Curso de automaquiagem pode rodar em dias de semana (tratado à parte).
  course_working_hours: {
    mon: [["09:00", "19:00"]],
    tue: [["09:00", "19:00"]],
    wed: [["09:00", "19:00"]],
    thu: [["09:00", "19:00"]],
    fri: [["09:00", "19:00"]],
    sat: [["09:00", "19:00"]],
    sun: [["09:00", "19:00"]],
  },
  buffer_min: 15,
  min_lead_hours: 24,
  max_lead_days: 90,
  reminder_hours: 24,
  cancel_window_days: 3,
  strike_limit: 3,
  hold_minutes: 8,
  slot_step_min: 30,
  timezone: "America/Sao_Paulo",
  deposit_policy: { default: "none", on_strikes: true },
};

type SeedService = {
  code: string;
  name: string;
  category:
    | "social"
    | "sobrancelha"
    | "cabelo"
    | "curso"
    | "noiva"
    | "debutante";
  durationMin: number;
  bufferMin: number;
  priceCents: number;
  priceHomeCents: number | null;
  bookableOnline: boolean;
  pendingPrice?: boolean;
  isCourse?: boolean;
};

const services: SeedService[] = [
  // ── Sociais (estúdio / domicílio) ──
  {
    code: "maquiagem-social",
    name: "Maquiagem social",
    category: "social",
    durationMin: 60, // ~confirmar
    bufferMin: 15,
    priceCents: BRL(250),
    priceHomeCents: BRL(380),
    bookableOnline: true,
  },
  {
    code: "penteado",
    name: "Penteado",
    category: "social",
    durationMin: 60, // ~confirmar
    bufferMin: 15,
    priceCents: BRL(350),
    priceHomeCents: BRL(470),
    bookableOnline: true,
  },
  {
    code: "pacote-completo",
    name: "Pacote completo (maquiagem + penteado)",
    category: "social",
    durationMin: 120, // ~confirmar
    bufferMin: 15,
    priceCents: BRL(550),
    priceHomeCents: BRL(800),
    bookableOnline: true,
  },
  // ── Prévia social (avulsa, no estúdio) ──
  {
    code: "previa-maquiagem",
    name: "Prévia de maquiagem",
    category: "social",
    durationMin: 60, // ~confirmar
    bufferMin: 15,
    priceCents: BRL(250),
    priceHomeCents: null,
    bookableOnline: true,
  },
  {
    code: "previa-penteado",
    name: "Prévia de penteado",
    category: "social",
    durationMin: 60, // ~confirmar
    bufferMin: 15,
    priceCents: BRL(350),
    priceHomeCents: null,
    bookableOnline: true,
  },
  {
    code: "previa-completa",
    name: "Prévia pacote completo",
    category: "social",
    durationMin: 120, // ~confirmar
    bufferMin: 15,
    priceCents: BRL(550),
    priceHomeCents: null,
    bookableOnline: true,
  },
  // ── Sobrancelha (preços a confirmar) ──
  {
    code: "sobrancelha-design",
    name: "Design de sobrancelha",
    category: "sobrancelha",
    durationMin: 30, // ~confirmar
    bufferMin: 15,
    priceCents: 0,
    priceHomeCents: null,
    bookableOnline: true,
    pendingPrice: true,
  },
  {
    code: "sobrancelha-henna",
    name: "Sobrancelha com henna",
    category: "sobrancelha",
    durationMin: 45, // ~confirmar
    bufferMin: 15,
    priceCents: 0,
    priceHomeCents: null,
    bookableOnline: true,
    pendingPrice: true,
  },
  {
    code: "brow-lamination",
    name: "Brow lamination",
    category: "sobrancelha",
    durationMin: 60, // ~confirmar
    bufferMin: 15,
    priceCents: 0,
    priceHomeCents: null,
    bookableOnline: true,
    pendingPrice: true,
  },
  // ── Cabelo · Dia a Dia (M9) — preços/durações/dias A CONFIRMAR COM A MI ──
  // <!-- APROVAR COM A MI: durações são estimativas; dias/horários definidos
  //      por serviço em service_availability (admin); preço pendente. -->
  {
    code: "escova",
    name: "Escova",
    category: "cabelo",
    durationMin: 60, // ~confirmar
    bufferMin: 15,
    priceCents: 0,
    priceHomeCents: null,
    bookableOnline: true,
    pendingPrice: true,
  },
  {
    code: "hidratacao",
    name: "Hidratação",
    category: "cabelo",
    durationMin: 60, // ~confirmar
    bufferMin: 15,
    priceCents: 0,
    priceHomeCents: null,
    bookableOnline: true,
    pendingPrice: true,
  },
  {
    code: "reconstrucao",
    name: "Reconstrução",
    category: "cabelo",
    durationMin: 90, // ~confirmar
    bufferMin: 15,
    priceCents: 0,
    priceHomeCents: null,
    bookableOnline: true,
    pendingPrice: true,
  },
  {
    code: "cronograma-capilar",
    name: "Cronograma capilar",
    category: "cabelo",
    durationMin: 90, // ~confirmar
    bufferMin: 15,
    priceCents: 0,
    priceHomeCents: null,
    bookableOnline: true,
    pendingPrice: true,
  },
  // ── Curso de automaquiagem (turma de 1 aluna, dias de semana ok) ──
  {
    code: "curso-automaquiagem",
    name: "Curso de automaquiagem",
    category: "curso",
    durationMin: 120, // confirmado pela skill (2h)
    bufferMin: 15,
    priceCents: BRL(280),
    priceHomeCents: null,
    bookableOnline: true,
    isCourse: true,
  },
  // ── Vitrine — NUNCA agendáveis online (R1), só CTA WhatsApp ──
  {
    code: "noiva-la-mariee",
    name: "Noiva (La Mariée)",
    category: "noiva",
    durationMin: 180,
    bufferMin: 15,
    priceCents: BRL(3287), // pacote Exclusivo (referência de vitrine)
    priceHomeCents: null,
    bookableOnline: false,
  },
  {
    code: "debutante",
    name: "Debutante",
    category: "debutante",
    durationMin: 120,
    bufferMin: 15,
    priceCents: BRL(2979), // pacote Básico (referência de vitrine)
    priceHomeCents: null,
    bookableOnline: false,
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Categorias financeiras padrão (módulo Financeiro). Seed idempotente por `code`,
// roda SEMPRE (fora do --if-empty) p/ popular bancos já existentes. A Mi edita/
// cria mais no painel. dreGroup define a linha do DRE; isCmv marca insumo.
// ─────────────────────────────────────────────────────────────────────────────
type SeedCategory = {
  code: string;
  name: string;
  kind: "expense" | "revenue";
  nature?: "fixed" | "variable";
  dreGroup?: "deducao_venda" | "custo_variavel" | "custo_fixo" | "pro_labore";
  isCmv?: boolean;
  color: string;
  sort: number;
};

const financialCategories: SeedCategory[] = [
  // Receita por origem (espelha service.category + venda avulsa)
  {
    code: "rev-social",
    name: "Maquiagem social",
    kind: "revenue",
    color: "#8A7361",
    sort: 1,
  },
  {
    code: "rev-cabelo",
    name: "Cabelo / dia a dia",
    kind: "revenue",
    color: "#A68A6D",
    sort: 2,
  },
  {
    code: "rev-sobrancelha",
    name: "Sobrancelha",
    kind: "revenue",
    color: "#B9A487",
    sort: 3,
  },
  {
    code: "rev-curso",
    name: "Curso de automaquiagem",
    kind: "revenue",
    color: "#C9B89C",
    sort: 4,
  },
  {
    code: "rev-noiva",
    name: "Noiva (La Mariée)",
    kind: "revenue",
    color: "#7A5C49",
    sort: 5,
  },
  {
    code: "rev-debutante",
    name: "Debutante",
    kind: "revenue",
    color: "#9C6F52",
    sort: 6,
  },
  {
    code: "rev-avulsa",
    name: "Venda avulsa",
    kind: "revenue",
    color: "#D8CBB6",
    sort: 7,
  },
  // Deduções sobre venda
  {
    code: "exp-taxa-cartao",
    name: "Taxa de maquininha",
    kind: "expense",
    nature: "variable",
    dreGroup: "deducao_venda",
    color: "#C98A6B",
    sort: 10,
  },
  {
    code: "exp-das",
    name: "DAS / Impostos sobre venda",
    kind: "expense",
    nature: "variable",
    dreGroup: "deducao_venda",
    color: "#B5705A",
    sort: 11,
  },
  // Custos variáveis
  {
    code: "exp-insumos",
    name: "Insumos e descartáveis",
    kind: "expense",
    nature: "variable",
    dreGroup: "custo_variavel",
    isCmv: true,
    color: "#8A9A5B",
    sort: 20,
  },
  {
    code: "exp-deslocamento",
    name: "Deslocamento",
    kind: "expense",
    nature: "variable",
    dreGroup: "custo_variavel",
    color: "#6B8E9A",
    sort: 21,
  },
  {
    code: "exp-comissao",
    name: "Comissão 2ª profissional",
    kind: "expense",
    nature: "variable",
    dreGroup: "custo_variavel",
    color: "#7C9A6B",
    sort: 22,
  },
  {
    code: "exp-brindes",
    name: "Brindes e embalagens",
    kind: "expense",
    nature: "variable",
    dreGroup: "custo_variavel",
    color: "#A88FB0",
    sort: 23,
  },
  // Custos fixos
  {
    code: "exp-aluguel",
    name: "Aluguel do estúdio",
    kind: "expense",
    nature: "fixed",
    dreGroup: "custo_fixo",
    color: "#5C4A3D",
    sort: 30,
  },
  {
    code: "exp-energia",
    name: "Energia e climatização",
    kind: "expense",
    nature: "fixed",
    dreGroup: "custo_fixo",
    color: "#6E5A4A",
    sort: 31,
  },
  {
    code: "exp-agua",
    name: "Água",
    kind: "expense",
    nature: "fixed",
    dreGroup: "custo_fixo",
    color: "#4A6E7A",
    sort: 32,
  },
  {
    code: "exp-internet",
    name: "Internet",
    kind: "expense",
    nature: "fixed",
    dreGroup: "custo_fixo",
    color: "#7A6E5A",
    sort: 33,
  },
  {
    code: "exp-software",
    name: "Software, VPS e domínio",
    kind: "expense",
    nature: "fixed",
    dreGroup: "custo_fixo",
    color: "#8A7361",
    sort: 34,
  },
  {
    code: "exp-contador",
    name: "Contador",
    kind: "expense",
    nature: "fixed",
    dreGroup: "custo_fixo",
    color: "#9A8A7A",
    sort: 35,
  },
  // Pró-labore (isolado no DRE)
  {
    code: "exp-prolabore",
    name: "Pró-labore da Mi",
    kind: "expense",
    dreGroup: "pro_labore",
    color: "#3D3733",
    sort: 40,
  },
];

/** Semeia/atualiza as categorias financeiras padrão (idempotente por code). */
async function ensureFinancialCategories() {
  for (const c of financialCategories) {
    const data = {
      name: c.name,
      kind: c.kind,
      nature: c.nature ?? null,
      dreGroup: c.dreGroup ?? null,
      isCmv: c.isCmv ?? false,
      color: c.color,
      sort: c.sort,
      isDefault: true,
    };
    await prisma.financialCategory.upsert({
      where: { code: c.code },
      update: data,
      create: { code: c.code, ...data },
    });
  }
  console.log(
    `✓ financial_categories: ${financialCategories.length} categorias`,
  );
}

/**
 * Bootstrap da conta do painel /admin (M5). Roda SEMPRE (mesmo com --if-empty),
 * mas só cria se o e-mail ainda não existir — nunca sobrescreve senha trocada.
 * ADMIN_EMAIL/ADMIN_PASSWORD vêm do ambiente (Dokploy — R9).
 */
async function ensureAdmin() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) {
    console.log("admin: ADMIN_EMAIL/ADMIN_PASSWORD ausentes — pulado");
    return;
  }
  const exists = await prisma.adminUser.findUnique({ where: { email } });
  if (exists) {
    console.log(`admin: ${email} já existe — mantido`);
    return;
  }
  await prisma.adminUser.create({
    data: {
      email,
      name: process.env.ADMIN_NAME?.trim() || "Mi",
      passwordHash: bcrypt.hashSync(password, 12),
    },
  });
  console.log(`✓ admin: ${email} criado`);
}

async function main() {
  await ensureAdmin();
  await ensureFinancialCategories();

  // Profissional única (schema já suporta N) — ANTES do --if-empty.
  // A trava anti-double-booking é `EXCLUDE ... professional_id WITH =`, e em
  // PostgreSQL `=` com NULL nunca conflita: sem profissional no banco, todo
  // agendamento nasce com professional_id NULL e a R2 fica desarmada em
  // silêncio. Como uma migration já insere serviços, o --if-empty abaixo
  // encontrava serviços > 0 e voltava antes de criar a profissional — num
  // banco virgem o portal subia sem trava. Idempotente, pode rodar sempre.
  const existing = await prisma.professional.findFirst({
    where: { name: "Milene Ozorio" },
  });
  if (!existing) {
    await prisma.professional.create({ data: { name: "Milene Ozorio" } });
  }
  console.log("✓ professional: Milene Ozorio");

  // --if-empty (entrypoint do container): só semeia banco virgem, para nunca
  // sobrescrever ajustes feitos pela Mi no admin (R3) num restart.
  if (process.argv.includes("--if-empty")) {
    const count = await prisma.service.count();
    if (count > 0) {
      console.log(`seed: pulado (--if-empty, ${count} serviços já existem)`);
      return;
    }
  }

  // Configurações do negócio
  for (const [key, value] of Object.entries(businessSettings)) {
    await prisma.businessSetting.upsert({
      where: { key },
      update: { value },
      create: { key, value },
    });
  }
  console.log(
    `✓ business_settings: ${Object.keys(businessSettings).length} chaves`,
  );

  // Serviços (idempotente por code)
  for (const s of services) {
    await prisma.service.upsert({
      where: { code: s.code },
      update: {
        name: s.name,
        category: s.category,
        durationMin: s.durationMin,
        bufferMin: s.bufferMin,
        priceCents: s.priceCents,
        priceHomeCents: s.priceHomeCents,
        bookableOnline: s.bookableOnline,
        pendingPrice: s.pendingPrice ?? false,
        isCourse: s.isCourse ?? false,
      },
      create: {
        code: s.code,
        name: s.name,
        category: s.category,
        durationMin: s.durationMin,
        bufferMin: s.bufferMin,
        priceCents: s.priceCents,
        priceHomeCents: s.priceHomeCents,
        bookableOnline: s.bookableOnline,
        pendingPrice: s.pendingPrice ?? false,
        isCourse: s.isCourse ?? false,
      },
    });
  }
  console.log(`✓ services: ${services.length} serviços`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
