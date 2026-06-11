import { PrismaClient, Prisma } from "@prisma/client";

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
  category: "social" | "sobrancelha" | "curso" | "noiva" | "debutante";
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

async function main() {
  // Configurações do negócio
  for (const [key, value] of Object.entries(businessSettings)) {
    await prisma.businessSetting.upsert({
      where: { key },
      update: { value },
      create: { key, value },
    });
  }
  console.log(`✓ business_settings: ${Object.keys(businessSettings).length} chaves`);

  // Profissional única (schema já suporta N)
  const existing = await prisma.professional.findFirst({
    where: { name: "Milene Ozorio" },
  });
  if (!existing) {
    await prisma.professional.create({ data: { name: "Milene Ozorio" } });
  }
  console.log("✓ professional: Milene Ozorio");

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
