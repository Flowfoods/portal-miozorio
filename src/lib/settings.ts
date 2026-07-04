import { prisma } from "./prisma";

export type WeeklyHours = Record<string, [string, string][]>;

/** Degrau da escada de indicação do Clube (configurável — R3). */
export interface ClubLadderStep {
  nivel: number;
  beneficio: string;
}

/** Escopo do bônus de indicação percentual (R3, configurável pela Mi). */
export type ReferralScope = "PRIMEIRO_ATENDIMENTO" | "TODOS_ATENDIMENTOS";

export interface BusinessSettings {
  workingHours: WeeklyHours;
  courseWorkingHours: WeeklyHours;
  bufferMin: number;
  minLeadHours: number;
  maxLeadDays: number;
  reminderHours: number;
  cancelWindowDays: number;
  strikeLimit: number;
  holdMinutes: number;
  slotStepMin: number;
  timezone: string;
  depositPolicy: { default: string; on_strikes: boolean };
  clubLadder: ClubLadderStep[];
  clubPointsPerReferral: number;
  // Indicação PERCENTUAL: a indicadora ganha uma % dos pontos que a indicada
  // ganhou no atendimento. Substitui a pontuação fixa (legado de leitura). R3.
  clubReferralPercent: number; // 0–100, aceita decimais (ex.: 12.5)
  clubReferralScope: ReferralScope;
  clubReferralActive: boolean;
  // Área da Cliente (F1) — 0 = desligado até a Mi definir no admin (R3).
  clubPointsDepoimento: number;
  clubPointsFoto: number;
  clubPointsReagendamento: number;
}

/** Fallback da escada do Clube (a migration insere a versão oficial no banco). */
export const DEFAULT_CLUB_LADDER: ClubLadderStep[] = [
  { nivel: 1, beneficio: "Mimo de agradecimento (a confirmar com a Mi)" },
  { nivel: 3, beneficio: "Benefício especial (a confirmar com a Mi)" },
  { nivel: 5, beneficio: "Cortesia premium (combinar direto com a Mi)" },
];

const DEFAULTS: BusinessSettings = {
  workingHours: {
    sat: [["09:00", "19:00"]],
    sun: [["09:00", "19:00"]],
  },
  courseWorkingHours: {},
  bufferMin: 15,
  minLeadHours: 24,
  maxLeadDays: 90,
  reminderHours: 24,
  cancelWindowDays: 3,
  strikeLimit: 3,
  holdMinutes: 8,
  slotStepMin: 30,
  timezone: "America/Sao_Paulo",
  depositPolicy: { default: "none", on_strikes: true },
  clubLadder: DEFAULT_CLUB_LADDER,
  clubPointsPerReferral: 100,
  clubReferralPercent: 20,
  clubReferralScope: "PRIMEIRO_ATENDIMENTO",
  clubReferralActive: true,
  clubPointsDepoimento: 0,
  clubPointsFoto: 0,
  clubPointsReagendamento: 0,
};

const TTL_MS = 60_000;
let cache: { at: number; data: BusinessSettings } | null = null;

/** Leitura cacheada de business_settings (R3). 60s de TTL. */
export async function getSettings(force = false): Promise<BusinessSettings> {
  if (!force && cache && Date.now() - cache.at < TTL_MS) return cache.data;

  const rows = await prisma.businessSetting.findMany();
  const m = new Map(rows.map((r) => [r.key, r.value]));

  const num = (k: string, d: number): number => {
    const v = m.get(k);
    return typeof v === "number" ? v : d;
  };
  const str = (k: string, d: string): string => {
    const v = m.get(k);
    return typeof v === "string" ? v : d;
  };
  const bool = (k: string, d: boolean): boolean => {
    const v = m.get(k);
    return typeof v === "boolean" ? v : d;
  };

  const data: BusinessSettings = {
    workingHours:
      (m.get("working_hours") as unknown as WeeklyHours | undefined) ??
      DEFAULTS.workingHours,
    courseWorkingHours:
      (m.get("course_working_hours") as unknown as WeeklyHours | undefined) ??
      DEFAULTS.courseWorkingHours,
    bufferMin: num("buffer_min", DEFAULTS.bufferMin),
    minLeadHours: num("min_lead_hours", DEFAULTS.minLeadHours),
    maxLeadDays: num("max_lead_days", DEFAULTS.maxLeadDays),
    reminderHours: num("reminder_hours", DEFAULTS.reminderHours),
    cancelWindowDays: num("cancel_window_days", DEFAULTS.cancelWindowDays),
    strikeLimit: num("strike_limit", DEFAULTS.strikeLimit),
    holdMinutes: num("hold_minutes", DEFAULTS.holdMinutes),
    slotStepMin: num("slot_step_min", DEFAULTS.slotStepMin),
    timezone: str("timezone", DEFAULTS.timezone),
    depositPolicy:
      (m.get("deposit_policy") as unknown as
        | BusinessSettings["depositPolicy"]
        | undefined) ?? DEFAULTS.depositPolicy,
    clubLadder:
      (m.get("club_ladder") as unknown as ClubLadderStep[] | undefined) ??
      DEFAULTS.clubLadder,
    clubPointsPerReferral: num(
      "club_points_per_referral",
      DEFAULTS.clubPointsPerReferral,
    ),
    clubReferralPercent: (() => {
      const v = num("club_referral_percent", DEFAULTS.clubReferralPercent);
      // Blindagem: percentual sempre em [0, 100] (R3 valida na escrita também).
      return Math.min(100, Math.max(0, v));
    })(),
    clubReferralScope:
      m.get("club_referral_scope") === "TODOS_ATENDIMENTOS"
        ? "TODOS_ATENDIMENTOS"
        : DEFAULTS.clubReferralScope,
    clubReferralActive: bool(
      "club_referral_active",
      DEFAULTS.clubReferralActive,
    ),
    clubPointsDepoimento: num(
      "club_points_depoimento",
      DEFAULTS.clubPointsDepoimento,
    ),
    clubPointsFoto: num("club_points_foto", DEFAULTS.clubPointsFoto),
    clubPointsReagendamento: num(
      "club_points_reagendamento",
      DEFAULTS.clubPointsReagendamento,
    ),
  };

  cache = { at: Date.now(), data };
  return data;
}

export function invalidateSettingsCache(): void {
  cache = null;
}
