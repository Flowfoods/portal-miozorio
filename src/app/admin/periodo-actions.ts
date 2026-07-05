"use server";

import { cookies } from "next/headers";
import { requireAdmin } from "@/lib/auth";

/**
 * Persistência do último período escolhido POR MÓDULO (F1.2): cookie httpOnly
 * gravado no servidor (decisão do diagnóstico — zero migration; preferência de
 * UI por navegador basta). O valor é o fragmento de query canônico
 * ("periodo=ultimos7" ou "de=...&ate=..."); a leitura reusa o parsePeriodo.
 */

const MODULOS = ["agenda", "financeiro", "resumo", "crm", "clube", "clientes"] as const;
export type PeriodoModulo = (typeof MODULOS)[number];

const UM_ANO_S = 365 * 24 * 60 * 60;
// Só os formatos canônicos entram no cookie (nada arbitrário).
const QUERY_RE =
  /^(periodo=(hoje|ultimos7|ultimos30|mesAnterior)|de=\d{4}-\d{2}-\d{2}&ate=\d{4}-\d{2}-\d{2})$/;

export async function salvarPeriodoPref(
  modulo: string,
  query: string,
): Promise<void> {
  await requireAdmin();
  if (!(MODULOS as readonly string[]).includes(modulo)) return;
  if (!QUERY_RE.test(query)) return;
  cookies().set(`mi_periodo_${modulo}`, query, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/admin",
    maxAge: UM_ANO_S,
  });
}
