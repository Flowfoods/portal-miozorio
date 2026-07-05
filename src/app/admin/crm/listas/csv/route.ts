import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth";
import { getCrmConfig } from "@/lib/crm-config";
import { formatPhoneBR } from "@/lib/format";
import {
  clientesSumidas,
  leadsNuncaEntraram,
  visitouNaoMarcou,
  engajadasIndicacao,
  explorarClientes,
} from "@/lib/crm-listas";

// Export CSV das listas de ação (F3). Só admin logada (defesa dupla: o
// middleware já protege /admin, e aqui checamos a sessão de novo).
export const dynamic = "force-dynamic";

const esc = (v: unknown) => {
  const s = String(v ?? "");
  return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const csv = (cab: string[], linhas: unknown[][]) =>
  "﻿" + // BOM p/ Excel abrir acentos certo
  [cab, ...linhas].map((l) => l.map(esc).join(";")).join("\r\n");

export async function GET(req: NextRequest) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const cfg = await getCrmConfig();
  const sp = req.nextUrl.searchParams;
  const tipo = sp.get("tipo") ?? "sumidas";

  const nome = tipo;
  let corpo = "";

  if (tipo === "sumidas") {
    const rows = await clientesSumidas(cfg.limiares.sumidaDias);
    corpo = csv(
      ["Nome", "WhatsApp", "Dias sem vir", "Total investido (R$)", "Segmento"],
      rows.map((r) => [
        r.name,
        formatPhoneBR(r.phoneE164),
        r.diasSemVir,
        (r.totalGastoCents / 100).toFixed(2).replace(".", ","),
        r.rfvSegmento ?? "",
      ]),
    );
  } else if (tipo === "leads") {
    const rows = await leadsNuncaEntraram(cfg.limiares.leadFriaDias);
    corpo = csv(
      ["Nome", "WhatsApp", "Cadastrada há (dias)", "Origem"],
      rows.map((r) => [
        r.name,
        formatPhoneBR(r.phoneE164),
        r.criadaHaDias,
        r.funilEtapa ? `funil (${r.funilEtapa})` : (r.origem ?? ""),
      ]),
    );
  } else if (tipo === "visitou") {
    const rows = await visitouNaoMarcou(30);
    corpo = csv(
      ["Nome", "WhatsApp", "Tentativas (30d)", "Última vez"],
      rows.map((r) => [
        r.name,
        formatPhoneBR(r.phoneE164),
        r.tentativas,
        r.ultimaVez.toISOString().slice(0, 10),
      ]),
    );
  } else if (tipo === "indicacao") {
    const rows = await engajadasIndicacao();
    corpo = csv(
      ["Nome", "WhatsApp", "Compartilhamentos", "Indicadas atendidas"],
      rows.map((r) => [
        r.name,
        formatPhoneBR(r.phoneE164),
        r.compartilhamentos,
        r.indicadasAtendidas,
      ]),
    );
  } else if (tipo === "explorar") {
    const rows = await explorarClientes({
      segmento: sp.get("seg") || undefined,
      semContatoDias: sp.get("dias") ? Number(sp.get("dias")) : undefined,
      compartilhou:
        sp.get("comp") === "sim"
          ? true
          : sp.get("comp") === "nao"
            ? false
            : undefined,
      origem: sp.get("origem") || undefined,
    });
    corpo = csv(
      [
        "Nome",
        "WhatsApp",
        "Segmento",
        "Dias sem vir",
        "Visitas 30d",
        "Tentativas 30d",
        "Indicações",
        "Total investido (R$)",
      ],
      rows.map((r) => [
        r.name,
        formatPhoneBR(r.phoneE164),
        r.rfvSegmento ?? "",
        r.diasSemVir ?? "",
        r.visitas30d,
        r.tentativas30d,
        r.indicacoes,
        (r.totalGastoCents / 100).toFixed(2).replace(".", ","),
      ]),
    );
  } else {
    return NextResponse.json({ error: "tipo inválido" }, { status: 400 });
  }

  return new NextResponse(corpo, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="mi-ozorio-${nome}.csv"`,
    },
  });
}
