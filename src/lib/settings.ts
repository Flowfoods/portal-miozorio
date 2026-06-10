import { prisma } from "./prisma";

export type WeeklyHours = Record<string, [string, string][]>;

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
}

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
  };

  cache = { at: Date.now(), data };
  return data;
}

export function invalidateSettingsCache(): void {
  cache = null;
}
