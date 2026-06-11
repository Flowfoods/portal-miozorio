import { z } from "zod";

export const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
export const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export const availabilityQuery = z.object({
  serviceId: z.string().regex(UUID_RE),
  date: z.string().regex(DATE_RE),
  location: z.enum(["studio", "home"]).optional(),
});

export const createBookingBody = z.object({
  serviceId: z.string().regex(UUID_RE),
  date: z.string().regex(DATE_RE),
  time: z.string().regex(TIME_RE),
  location: z.enum(["studio", "home"]).default("studio"),
  customer: z.object({
    name: z.string().min(2),
    phone: z.string().min(8),
    email: z.string().regex(EMAIL_RE).optional(),
    birthDate: z.string().regex(DATE_RE).optional(),
    guardianName: z.string().optional(),
    guardianPhone: z.string().optional(),
  }),
  anamnesis: z.record(z.string(), z.unknown()).optional(),
  lgpdConsent: z.boolean(),
});

export const cancelBody = z.object({
  actor: z.enum(["client", "business"]).default("client"),
});
